
export interface EvalLead {
    id: string;
    fullName: string;
    title: string;
    company: string;
    employeeRange: string;
    groundTruthRank: number | null; // null = irrelevant
}

export interface Metrics {
    precision: number;
    recall: number;
    f1: number;
    ndcgAt3: number;
    composite: number;
    falsePositives: EvalLead[];
    falseNegatives: EvalLead[];
}

export function computeMetrics(
    predictions: Map<string, { is_relevant: boolean; rank: number | null }>,
    groundTruth: EvalLead[]
): Metrics {
    let tp = 0, fp = 0, fn = 0;
    const falsePositives: EvalLead[] = [];
    const falseNegatives: EvalLead[] = [];

    for (const truth of groundTruth) {
        const pred = predictions.get(truth.id);
        // If we didn't get a prediction for this lead, treat as negative (irrelevant)
        const predictedRelevant = pred ? pred.is_relevant : false;
        const actualRelevant = truth.groundTruthRank !== null;

        if (predictedRelevant && actualRelevant) tp++;
        else if (predictedRelevant && !actualRelevant) {
            fp++;
            falsePositives.push(truth);
        }
        else if (!predictedRelevant && actualRelevant) {
            fn++;
            falseNegatives.push(truth);
        }
    }

    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const f1 = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0;

    const ndcgAt3 = computeAverageNDCG(predictions, groundTruth, 3);
    const composite = 0.6 * f1 + 0.4 * ndcgAt3;

    return { precision, recall, f1, ndcgAt3, composite, falsePositives, falseNegatives };
}

function computeAverageNDCG(
    predictions: Map<string, { is_relevant: boolean; rank: number | null }>,
    groundTruth: EvalLead[],
    k: number
): number {
    // Group by company
    const byCompany = new Map<string, EvalLead[]>();
    for (const lead of groundTruth) {
        const list = byCompany.get(lead.company) || [];
        list.push(lead);
        byCompany.set(lead.company, list);
    }

    let totalNdcg = 0;
    let count = 0;

    for (const [, leads] of byCompany) {
        const rankedLeads = leads.filter(l => l.groundTruthRank !== null);
        if (rankedLeads.length === 0) continue; // No relevant leads in ground truth for this company

        // Get predictions sorted by rank
        // We only consider predicted relevant leads for the ranking metric
        const preds = leads
            .map(l => ({ lead: l, pred: predictions.get(l.id) }))
            .filter(x => x.pred && x.pred.is_relevant && x.pred.rank !== null)
            .sort((a, b) => a.pred!.rank! - b.pred!.rank!);

        // Compute DCG
        let dcg = 0;
        // We calculate relevance based on ground truth rank
        // Relevance = maxRank - rank + 1. If not relevant in GT, relevance is 0.
        const maxRank = Math.max(...rankedLeads.map(l => l.groundTruthRank!));

        const getRelevance = (lead: EvalLead) => {
            if (lead.groundTruthRank === null) return 0;
            return maxRank - lead.groundTruthRank + 1;
        };

        for (let i = 0; i < Math.min(k, preds.length); i++) {
            // DCG formula: rel_i / log2(i+2)
            // i is 0-indexed here, so rank position is i+1. log2(i+1 + 1) = log2(i+2)
            dcg += getRelevance(preds[i].lead) / Math.log2(i + 2);
        }

        // Compute IDCG (Ideal DCG)
        // Sort ground truth leads by relevance
        const idealOrder = leads
            .map(l => getRelevance(l))
            .filter(r => r > 0)
            .sort((a, b) => b - a);

        let idcg = 0;
        for (let i = 0; i < Math.min(k, idealOrder.length); i++) {
            idcg += idealOrder[i] / Math.log2(i + 2);
        }

        if (idcg > 0) {
            totalNdcg += dcg / idcg;
            count++;
        }
    }

    return count > 0 ? totalNdcg / count : 0;
}
