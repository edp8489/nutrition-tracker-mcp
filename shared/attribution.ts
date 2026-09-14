/**
 * attribution.ts — dataset attribution embedded in every tool result (ADR-0008).
 */

import type { Attribution } from './types'

export const ATTRIBUTION: Attribution = {
  dataset: 'OpenNutrition',
  url: 'https://www.opennutrition.app',
  contributors: 'Open Food Facts contributors',
  contributorsUrl: 'https://world.openfoodfacts.org/terms-of-use',
  license: 'ODbL',
  notice:
    'Data: OpenNutrition (https://www.opennutrition.app) · (c) Open Food Facts contributors · ODbL',
}
