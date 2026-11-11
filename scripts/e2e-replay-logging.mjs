import { PuppeteerRunnerExtension } from '@puppeteer/replay';

export default class LoggingExtension extends PuppeteerRunnerExtension {
  async beforeEachStep(step, flow) {
    const index = flow.steps.indexOf(step);
    console.log(`Paso ${index + 1}/${flow.steps.length} (índice JSON ${index}): ${step.type}`);
  }
}
