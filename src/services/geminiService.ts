import { GoogleGenAI } from "@google/genai";
import { Defendant } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Chave de API do Gemini não configurada.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateLegalAnalysis = async (defendant: Defendant): Promise<string> => {
  try {
    const ai = getClient();

    // Convert contents to the format expected by the SDK
    // Note: Adjust based on the specific SDK version requirements
    const prompt = `
      Atue como um assistente jurídico sênior para a Vara Única de Goianésia do Pará.
      Analise os dados do seguinte réu preso e gere um breve resumo da situação jurídica, focando nos prazos:

      Dados:
      - Nome: ${defendant.name}
      - Processo: ${defendant.caseNumber}
      - Tipo Penal: ${defendant.penalType}
      - Data Prisão: ${defendant.arrestDate}
      - Data Última Revisão: ${defendant.lastReviewDate}
      - Status Atual: ${defendant.movementType} desde ${defendant.lastMovementDate}
      
      Verifique se há necessidade urgente de revisão da prisão (Art. 316 CPP - 90 dias) ou excesso de prazo na prisão provisória.
      Seja direto e formal.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{
        parts: [{ text: prompt }]
      }],
    });

    // Handling response structure carefully
    const result = response as any;
    if (typeof result.text === 'function') {
      return result.text();
    }
    if (result.response && typeof result.response.text === 'function') {
      return result.response.text();
    }

    return result?.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar a análise no momento.";

  } catch (error: any) {
    console.error("Erro ao consultar Gemini:", error);
    return `Erro na análise: ${error.message || "Erro desconhecido"}`;
  }
};