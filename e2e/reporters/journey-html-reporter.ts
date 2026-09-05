import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter"
import { writeHtmlReport } from "../helpers/journey.ts"

/** After the suite finishes, bake steps.json + screenshots into e2e-output/journey/index.html */
class JourneyHtmlReporter implements Reporter {
  private status = "unknown"

  onTestEnd(_test: TestCase, result: TestResult) {
    this.status = result.status
  }

  onEnd(_result: FullResult) {
    const reportPath = writeHtmlReport({ status: this.status })
    console.log(`\n📷 Journey report: ${reportPath}\n`)
  }
}

export default JourneyHtmlReporter
