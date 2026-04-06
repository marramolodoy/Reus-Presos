const getPrazo = (anos, meses = 0, dias = 0) => {
    const totalAnos = (anos || 0) + (meses || 0) / 12 + (dias || 0) / 365;
    if (totalAnos === 0) return 0;
    if (totalAnos > 12) return 20;
    if (totalAnos > 8) return 16;
    if (totalAnos > 4) return 12;
    if (totalAnos > 2) return 8;
    if (totalAnos >= 1) return 4;
    return 3;
};

const safeDate = (dStr) => {
    if (!dStr) return null;
    const d = new Date(dStr.includes('T') ? dStr : dStr + 'T12:00:00Z');
    return isNaN(d.getTime()) ? null : d;
};

const diffFormat = (d1, d2) => {
    const start = safeDate(d1 > d2 ? d2 : d1);
    const end = safeDate(d1 > d2 ? d1 : d2);
    if (!start || !end) return null;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diasTotal = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const anos = Math.floor(diasTotal / 365.25);
    const meses = Math.floor((diasTotal % 365.25) / 30.44);
    const dias = Math.floor((diasTotal % 365.25) % 30.44);
    return { anos, meses, dias, diasTotal, isNegative: d1 > d2 };
};

const addYearsToDate = (d, years) => {
    const date = safeDate(d);
    if (!date) return '';
    const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
    const newTime = date.getTime() + years * MS_PER_YEAR;
    return new Date(newTime).toISOString().split('T')[0];
};

function calculate(data) {
    const pMaxA = parseFloat(data.penaMaxAnos || 0);
    const pMaxM = parseFloat(data.penaMaxMeses || 0);
    const pAplA = parseFloat(data.penaAplAnos || 0);
    const pAplM = parseFloat(data.penaAplMeses || 0);

    let prazoBrutoAbstrato = getPrazo(pMaxA, pMaxM);
    let prazoBrutoConcreto = (pAplA > 0 || pAplM > 0) ? getPrazo(pAplA, pAplM) : 0;
    
    let prazoAbstrato = prazoBrutoAbstrato;
    let prazoConcreto = prazoBrutoConcreto > 0 ? prazoBrutoConcreto : null;
    
    let redutorAplica = false;

    const marcos = [];
    if (data.dataFato) marcos.push({ label: 'Data do Fato', date: data.dataFato });
    if (data.dataDenuncia) marcos.push({ label: 'Recebimento da Denúncia', date: data.dataDenuncia });
    if (data.dataPronuncia) marcos.push({ label: 'Pronúncia', date: data.dataPronuncia });
    if (data.dataConfirmacaoPronuncia) marcos.push({ label: 'Confirmação Pron.', date: data.dataConfirmacaoPronuncia });
    if (data.dataSentenca) marcos.push({ label: 'Publicação da Sentença', date: data.dataSentenca });
    if (data.dataInicioPena) marcos.push({ label: 'Início do Cumprimento', date: data.dataInicioPena });
    if (data.dataReincidencia) marcos.push({ label: 'Reincidência', date: data.dataReincidencia });

    const dataFimSuspensao = data.citadoEdital && data.dataSuspensao ? addYearsToDate(data.dataSuspensao, prazoAbstrato) : '';
    const marcosComSuspensao = [...marcos];
    if (dataFimSuspensao && data.dataSuspensao) {
        marcosComSuspensao.push({ label: 'Suspensão (Art. 366)', date: data.dataSuspensao, isSuspension: true });
        marcosComSuspensao.push({ label: 'Retomada (Súmula 415)', date: dataFimSuspensao, isRetomada: true });
    }
    marcosComSuspensao.sort((a, b) => a.date.localeCompare(b.date));

    const analiseIntervalos = [];
    let prescrito = false;
    let diffAcumuladaDias = 0; 

    for (let i = 0; i < marcosComSuspensao.length - 1; i++) {
        const mStart = marcosComSuspensao[i];
        const mEnd = marcosComSuspensao[i + 1];
        
        const isInterruptive = !mStart.isSuspension && !mStart.isRetomada;
        if (isInterruptive && i > 0) {
            diffAcumuladaDias = 0;
        }

        const isSuspendedPeriod = mStart.isSuspension || (marcosComSuspensao.some(m => m.isSuspension && m.date <= mStart.date) && !mStart.isRetomada && mEnd.date <= dataFimSuspensao);
        
        let paramLimit = prazoAbstrato;

        const diff = diffFormat(mStart.date, mEnd.date);
        if (!diff) continue;

        if (!isSuspendedPeriod) {
            diffAcumuladaDias += diff.diasTotal;
        }

        const anosAcumulados = diffAcumuladaDias / 365.25;

        analiseIntervalos.push({
            de: mStart.label,
            ate: mEnd.label,
            acumuladoAnos_calculado: anosAcumulados,
            suspenso: isSuspendedPeriod
        });
    }

    if (!prescrito && marcosComSuspensao.length > 0) {
        const lastMarco = marcosComSuspensao[marcosComSuspensao.length - 1];
        let projectionLimit = prazoAbstrato;

        if (!lastMarco.isSuspension && !lastMarco.isRetomada) {
            diffAcumuladaDias = 0;
        }

        const anosAcumuladosAteAgora = diffAcumuladaDias / 365.25;
        const anosRestantes = projectionLimit - anosAcumuladosAteAgora;
        const dataProjetada = addYearsToDate(lastMarco.date, anosRestantes);
        
        analiseIntervalos.push({
            de: lastMarco.label,
            ate: 'Expectativa',
            acumulado_usado: anosAcumuladosAteAgora,
            restante: anosRestantes,
            projecao: dataProjetada
        });
    }

    console.log(JSON.stringify(analiseIntervalos, null, 2));
}

calculate({
    infracao: 'A',
    penaMaxAnos: 2, // prazo 4 anos
    dataFato: '2010-01-01',
    dataDenuncia: '2012-01-01',
    citadoEdital: true,
    dataSuspensao: '2013-01-01', // suspende por 4 anos (2017-01-01)
    dataSentenca: '2019-01-01', // apos retomada (2 anos depois)
});

