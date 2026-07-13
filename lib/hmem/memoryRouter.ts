import { TokenBlock } from './types';
import { Tier1Scratchpad, Tier2IndexCache, Tier3SemanticGraph } from './tiers';

export class MemoryRouter {
  constructor(
    private t1: Tier1Scratchpad,
    private t2: Tier2IndexCache,
    private t3: Tier3SemanticGraph
  ) {}

  public routeBlock(agentId: string, turn: number, text: string): void {
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
    evictedFromT1.forEach(block => {
      const trackingDecayValue = block.avgAttentionWeight * Math.exp(-0.01 * turn);
      if (trackingDecayValue > 0.35) {
        this.t2.commitBlock(block.id, block.content);
      }
    });
  }
}
