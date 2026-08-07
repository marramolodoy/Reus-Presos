import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { calculateDaysDiff, calculateDaysUntil, THRESHOLD_REVIEW } from '../utils';

export type ExpiredItem = {
    id: string;
    title: string;
    subtitle: string;
    module: string;
    moduleKey: string;
    exactLocation?: string;
    expiredCause?: string;
    targetTab?: string;
    targetDirection?: string;
    daysOverdue: number;
    type: 'criminal' | 'civil' | 'penhora' | 'rogatory';
};

export const useExpiredDeadlines = (session: any, unitId?: string) => {
    const [expiredItems, setExpiredItems] = useState<ExpiredItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchDeadlines = useCallback(async () => {
        if (!session) {
            setLoading(false);
            return;
        }

        try {
            // Fetch all active items from the 4 main modules
            const [defendantsRes, civilRes, penhoraRes, rogatoryRes] = await Promise.all([
                supabase.from('defendants').select('id, name, case_number, last_review_date, last_movement_date, deadline, prison_type').is('deleted_at', null),
                supabase.from('civil_cases').select('id, name, case_number, deadline_date, is_concluded, category').is('deleted_at', null).eq('is_concluded', false),
                supabase.from('penhora_orders').select('id, name, case_number, deadline_date, is_concluded, type').is('deleted_at', null).eq('is_concluded', false),
                supabase.from('rogatory_letters').select('id, defendant_name, case_number, deadline_date, status, type, direction').is('deleted_at', null)
            ]);

            let newExpiredItems: ExpiredItem[] = [];

            // 1. Defedants (Criminal)
            if (defendantsRes.data) {
                defendantsRes.data.forEach((d: any) => {
                    const daysSinceReview = calculateDaysDiff(d.last_review_date);
                    const daysSinceMovement = calculateDaysDiff(d.last_movement_date);
                    const prazo = d.deadline || 0;

                    // Completely exclude Preventivos and Recurso tabs from expired deadlines alerts
                    const isPreventiveOrRecurso = !d.prison_type || ['Preventiva', 'Temporária', 'Recurso'].includes(d.prison_type);
                    if (isPreventiveOrRecurso) return;

                    const excludeFromReview = ['Provisória', 'Definitiva', 'Cível', 'Civil', 'Liberdade Provisória'].includes(d.prison_type);

                    let overdue = 0;
                    let expiredCause = '';
                    if (!excludeFromReview && daysSinceReview > THRESHOLD_REVIEW) {
                        overdue = daysSinceReview - THRESHOLD_REVIEW;
                        expiredCause = 'Reavaliação de Prisão';
                    } else if (daysSinceMovement > prazo) {
                        overdue = daysSinceMovement - prazo;
                        expiredCause = 'Excesso de Prazo / Movimentação';
                    }

                    if (overdue > 0) {
                        let location = 'Réus Presos';
                        let tab = 'preventive';
                        if (d.prison_type === 'Domiciliar') { location = 'Prisão Domiciliar'; tab = 'home_arrest'; }
                        else if (d.prison_type === 'Recurso') { location = 'Recurso (RESE)'; tab = 'recurso'; }
                        else if (d.prison_type === 'Provisória' || d.prison_type === 'Definitiva') { location = 'Provisória/Definitiva'; tab = 'provisional_definitive'; }
                        else if (d.prison_type === 'Cível' || d.prison_type === 'Civil') { location = 'Prisão Civil'; tab = 'civil'; }
                        else if (d.prison_type === 'Liberdade Provisória') { location = 'Liberdade Provisória'; tab = 'provisional_liberty'; }
                        else if (d.prison_type === 'Juiz das Garantias') { location = 'Juiz das Garantias'; tab = 'garantias'; }

                        newExpiredItems.push({
                            id: d.id,
                            title: d.name,
                            subtitle: d.case_number || 'Sem número',
                            module: 'Criminal',
                            moduleKey: 'criminal',
                            exactLocation: location,
                            expiredCause: expiredCause,
                            targetTab: tab,
                            daysOverdue: overdue,
                            type: 'criminal'
                        });
                    }
                });
            }

            // 2. Civil Cases
            if (civilRes.data) {
                civilRes.data.forEach((c: any) => {
                    if (c.deadline_date) {
                        const daysUntil = calculateDaysUntil(c.deadline_date);
                        if (daysUntil < 0) {
                            newExpiredItems.push({
                                id: c.id,
                                title: c.name,
                                subtitle: c.case_number || 'Sem número',
                                module: 'Cível',
                                moduleKey: 'civil',
                                exactLocation: c.category || 'Geral',
                                expiredCause: 'Prazo Vencido',
                                targetTab: c.category || 'Urgentes',
                                daysOverdue: Math.abs(daysUntil),
                                type: 'civil'
                            });
                        }
                    }
                });
            }

            // 3. Penhora
            if (penhoraRes.data) {
                penhoraRes.data.forEach((p: any) => {
                    if (p.deadline_date) {
                        const daysUntil = calculateDaysUntil(p.deadline_date);
                        if (daysUntil < 0) {
                            newExpiredItems.push({
                                id: p.id,
                                title: p.name,
                                subtitle: p.case_number || 'Sem número',
                                module: 'Penhora',
                                moduleKey: 'penhora',
                                exactLocation: p.type || 'Geral',
                                expiredCause: 'Prazo Vencido',
                                targetTab: p.type || 'Sisbajud',
                                daysOverdue: Math.abs(daysUntil),
                                type: 'penhora'
                            });
                        }
                    }
                });
            }

            // 4. Rogatory
            if (rogatoryRes.data) {
                rogatoryRes.data.forEach((r: any) => {
                    if (r.status !== 'completed' && r.status !== 'returned' && r.deadline_date) {
                        const daysUntil = calculateDaysUntil(r.deadline_date);
                        if (daysUntil < 0) {
                            const dirLabel = r.direction === 'outgoing' ? 'Expedida' : 'Recebida';
                            const typeLabel = r.type === 'civil' ? 'Cível' : 'Criminal';

                            newExpiredItems.push({
                                id: r.id,
                                title: r.defendant_name,
                                subtitle: r.case_number || 'Sem número',
                                module: 'Precatórias',
                                moduleKey: 'rogatory',
                                exactLocation: `${dirLabel} - ${typeLabel}`,
                                expiredCause: 'Prazo de Cumprimento',
                                targetTab: r.type || 'criminal',
                                targetDirection: r.direction || 'incoming',
                                daysOverdue: Math.abs(daysUntil),
                                type: 'rogatory'
                            });
                        }
                    }
                });
            }

            // Sort by most overdue first
            newExpiredItems.sort((a, b) => b.daysOverdue - a.daysOverdue);
            setExpiredItems(newExpiredItems);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error fetching expired deadlines:', error);
        } finally {
            setLoading(false);
        }
    }, [session, unitId]);

    useEffect(() => {
        fetchDeadlines();
        // Setup polling every 60 seconds
        const interval = setInterval(() => {
            fetchDeadlines();
        }, 60000);
        return () => clearInterval(interval);
    }, [fetchDeadlines]);

    return { expiredItems, loading, refresh: fetchDeadlines, lastUpdated };
};
