import { TokenBlock, RoutingDecision } from './types';
import { Tier1Scratchpad, Tier2IndexCache, Tier3SemanticGraph } from './tiers';
import { cosineSimilarity } from './similarity';

// Strong match to an existing graph concept: reinforce it directly instead
// of duplicating near-identical content into Tier2's compressed index.
const REINFORCE_THRESHOLD = 0.78;

// Below this decay value, evicted content isn't worth retaining anywhere.
const COMMIT_DECAY_THRESHOLD = 0.35;

export class MemoryRouter {
  constructor(
    private t1: Tier1Scratchpad,
    private t2: Tier2IndexCache,
    private t3: Tier3SemanticGraph
  ) {}

  /**
   * Formal routing decision: every block evicted from Tier1 is embedded
   * and checked against the Tier3 graph before deciding its fate.
   * Returns structured decisions (not preformatted strings) so callers —
   * UI included — can key off `destination` and `score` directly.
   */
  public async routeBlock(agentId: string, turn: number, text: string): Promise<RoutingDecision[]> {
    const decisions: RoutingDecision[] = [];
    const generatedTokenSize = Tier1Scratchpad.calculateTokens(text);
    const hash = text.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const attentionEntropy = Math.abs(Math.sin(hash));

    const currentBlock: TokenBlock = {
      id: `blk_${agentId}_t${turn}_${Date.now()}`,
      timestamp: Date.now(),
      content: text,
      tokenCount: generatedTokenSize,
      avgAttentionWeight: attentionEntropy
    };

    const evictedFromT1 = this.t1.appendBlock(currentBlock);

    for (const block of evictedFromT1) {
      const decayValue = block.avgAttentionWeight * Math.exp(-0.01 * turn);
      const blockEmbedding = await this.t2.generateEmbedding(block.content);

      const nodes = this.t3.getAllNodes();
      let bestNodeId: string | null = null;
      let bestScore = 0;
      for (const node of nodes) {
        if (node.anchorEmbedding.length === 0) continue;
        const score = cosineSimilarity(blockEmbedding, node.anchorEmbedding);
        if (score > bestScore) {
          bestScore = score;
          bestNodeId = node.id;
        }
      }

      if (bestNodeId && bestScore >= REINFORCE_THRESHOLD) {
        this.t3.connectNodes("global_root", bestNodeId, bestScore);
        this.t3.touchNode(bestNodeId, turn);
        decisions.push({
          blockId: block.id,
          destination: 'tier3',
          score: bestScore,
          message: `Routed "${block.id}" to Tier3 (reinforced "${bestNodeId}", similarity ${bestScore.toFixed(3)})`
        });
      } else if (decayValue > COMMIT_DECAY_THRESHOLD) {
        await this.t2.commitBlock(block.id, block.content);
        decisions.push({
          blockId: block.id,
          destination: 'tier2',
          score: decayValue,
          message: `Routed "${block.id}" to Tier2 (decay ${decayValue.toFixed(3)}, novelty vs graph ${(1 - bestScore).toFixed(3)})`
        });
      } else {
        decisions.push({
          blockId: block.id,
          destination: 'dropped',
          score: decayValue,
          message: `Dropped "${block.id}" (decay ${decayValue.toFixed(3)} below retention threshold)`
        });
      }
    }

    return decisions;
  }
}
