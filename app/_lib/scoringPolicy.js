export const SCORING_POLICY_VERSION = '2026-06-12';
export const SCORING_POLICY_REGIONS = ['UAE', 'USA'];

const SCORE_LABELS = {
  0: 'No Score',
  20: 'Low',
  25: 'Low',
  30: 'Low',
  40: 'Low',
  50: 'Medium',
  60: 'Medium',
  70: 'High',
  75: 'High',
  80: 'High',
  90: 'Very High',
  100: 'Very High',
};

export const DEFAULT_SCORING_POLICIES = {
  UAE: {
    region: 'UAE',
    version_label: SCORING_POLICY_VERSION,
    effective_date: '2026-06-12',
    currency: 'AED',
    methodology: 'UAE weighted model: Financial Health 70%, Restaurant Profile 30%.',
    modelWeights: [
      { model: 'Financial', weight: 70 },
      { model: 'Restaurant Profile', weight: 30 },
    ],
    displayGradeBands: [
      { grade: 'A', min: 80, max: 100 },
      { grade: 'B+', min: 75, max: 79.999 },
      { grade: 'B', min: 70, max: 74.999 },
      { grade: 'C+', min: 65, max: 69.999 },
      { grade: 'NM', min: 0, max: 64.999 },
    ],
    scoringRangeLogic: [
      { label: 'No Score', score: 0 },
      { label: 'Low', score: 25 },
      { label: 'Medium', score: 50 },
      { label: 'High', score: 75 },
      { label: 'Very High', score: 100 },
    ],
    riskCategories: [
      { category: 'A+', min: 90, max: 100, ceiling: '5%', votesRequired: 1, refinancingThreshold: '75%' },
      { category: 'A', min: 80, max: 90, ceiling: '4%', votesRequired: 1, refinancingThreshold: '75%' },
      { category: 'B+', min: 70, max: 80, ceiling: '3%', votesRequired: 2, refinancingThreshold: '75%' },
      { category: 'B', min: 60, max: 70, ceiling: '2%', votesRequired: 2, refinancingThreshold: '100%' },
      { category: 'C+', min: 55, max: 60, ceiling: '1%', votesRequired: 3, refinancingThreshold: '100%' },
      { category: 'C', min: 50, max: 55, ceiling: '<=1%', votesRequired: 3, refinancingThreshold: '100%' },
      { category: 'No Match', min: 0, max: 49.999, ceiling: '-', votesRequired: '-', refinancingThreshold: '-' },
    ],
    sections: [
      {
        id: 'core_financials',
        title: 'Core Financials',
        aggregateWeight: 70,
        categories: [
          {
            id: 'prerequisite_financial_health',
            title: 'Prerequisite (Financial Health)',
            criteria: [
              metric('ltm_revenue_company', 'LTM (last 12 months) revenue of the company', 7, [
                band(0, '< 2,500,000'),
                band(40, '>= 2,500,000 and < 5,000,000'),
                band(70, '>= 5,000,000 and < 10,000,000'),
                band(100, '>= 10,000,000'),
              ], { autoApprove: '>= 5,000,000', autoReject: '< 2,500,000' }),
            ],
          },
          {
            id: 'pos_revenue_volatility_trend',
            title: 'POS Revenue, Volatility and Trend Analysis (Financial Health)',
            criteria: [
              metric('pos_12m_avg_monthly_sales', 'POS: 12 Months Average Monthly Sales Size', 6, salesSizeBands(), { autoReject: '< 210,000' }),
              metric('pos_average_spend_per_head', 'POS: Average Spend per Head (SPH)', 3, [
                band(0, '< 90'),
                band(25, '>= 90 and < 140'),
                band(50, '>= 140 and < 200'),
                band(75, '>= 200 and < 300'),
                band(100, '>= 300'),
              ]),
              metric('pos_average_spend_per_transaction', 'POS: Average Spend per Transaction (SPT)', 3, [
                band(0, '< 150 AED'),
                band(25, '>= 150 and < 250 AED'),
                band(50, '>= 250 and < 350 AED'),
                band(75, '>= 350 and < 500 AED'),
                band(100, '>= 500 AED'),
              ]),
              metric('pos_revenue_corroboration_to_vat', 'POS: Revenue Corroboration to VAT', 3, percentAscendingBands(70, 80, 90, 100), { autoApprove: '>= 70%', autoReject: '< 70%' }),
              metric('pos_cash_share', 'POS: Cash Share of POS Revenue', 2, inversePercentBands(['<= 5%', '> 5% and <= 20%', '> 20% and <= 50%', '> 50%']), { autoApprove: '<= 5%', autoReject: '> 50%' }),
              metric('pos_monthly_sales_volatility', 'POS: Monthly Sales Volatility', 3, [
                band(0, '> 0.35'),
                band(25, '>= 0.22 and < 0.35'),
                band(50, '>= 0.15 and < 0.22'),
                band(75, '>= 0.08 and < 0.15'),
                band(100, '< 0.08'),
              ], { autoReject: '> 0.35' }),
              metric('pos_rent_to_revenue_ratio', 'POS: Rent to Revenue Ratio', 5, rentBands(), { autoReject: '> 15%' }),
              metric('pos_void_rate', 'POS: Void Rate', 0, [
                band(0, '> 3.5%'),
                band(25, '>= 2.5% and < 3.5%'),
                band(50, '>= 2.0% and < 2.5%'),
                band(75, '>= 1.5% and < 2.0%'),
                band(100, '< 1.5%'),
              ], { autoReject: '> 5%' }),
              metric('pos_delivery_vs_dine_in', 'POS: Delivery vs Dine In', 3, deliveryMixBands(), { autoReject: '> 35%' }),
            ],
          },
          {
            id: 'profitability',
            title: 'Profitability (Financial Health)',
            criteria: [
              metric('next_12m_projected_ebit', 'Next 12 months projected EBIT', 12, [
                band(0, '< -5%'),
                band(25, '>= -5% and < 0%'),
                band(50, '>= 0% and < 5%'),
                band(75, '>= 5% and < 7.5%'),
                band(100, '>= 7.5%'),
              ], { autoApprove: '>= 7.5%', autoReject: '< -5%' }),
            ],
          },
          {
            id: 'flags_financial_health',
            title: 'Flags (Financial Health)',
            criteria: [
              metric('personal_aecb_score', 'Personal AECB Score', 3, [
                band(0, '< 540'),
                band(50, '>= 540 and < 650'),
                band(70, '>= 650 and < 710'),
                band(90, '>= 710 and < 745'),
                band(100, '>= 745'),
              ], { autoApprove: '> 745' }),
              metric('reconstructed_business_credit_history', 'Reconstructed Business Credit History', 7, [
                band(0, '< 3.5'),
                band(25, '>= 3.5 and < 5'),
                band(50, '>= 5 and < 6'),
                band(75, '>= 6 and < 7'),
                band(100, '7'),
              ], { autoApprove: '7', autoReject: '< 3.5' }),
              metric('open_court_case_obligations', 'Open Court Case Obligations', 2, [
                band(0, 'YES'),
                band(100, 'NO'),
              ], { autoReject: 'Fine, civil or material obligation' }),
            ],
          },
          {
            id: 'cheques_financial_health',
            title: 'Cheques (Financial Health)',
            criteria: [
              metric('bounced_inf_chqs_last_3_6_12', 'Bounced INF CHQs last 3/6/12 Months', 3, [
                band(100, '<= 1 / 2 / 4'),
                band(50, 'At threshold'),
                band(0, '> 1 / 2 / 4'),
              ], { autoApprove: '<= 1 / 2 / 4', autoReject: '> 1 / 2 / 4' }),
              metric('total_rejected_chqs', 'Total Rejected CHQs', 2, [
                band(100, '<= 4 / 8 / 16'),
                band(50, 'At threshold'),
                band(0, '> 4 / 8 / 16'),
              ], { autoApprove: '<= 4 / 8 / 16', autoReject: '> 4 / 8 / 16' }),
              metric('avg_dpd_late_chqs_last_6m', 'AVG DPD for Late CHQs (Last 6 Months)', 3, [
                band(100, '<= 7'),
                band(0, '> 7'),
              ], { autoApprove: '<= 7' }),
            ],
          },
          {
            id: 'leverage_financial_health',
            title: 'Leverage (Financial Health)',
            criteria: [
              metric('pre_mezza_dbr', 'Pre-Mezza DBR (sum of all EMIs / avg revenue per month LTM)', 2, leverageBands(), { autoApprove: '< 10%', autoReject: '>= 25%' }),
              metric('pre_mezza_debt_revenue_ratio', 'Pre-Mezza Debt-Revenue Ratio (sum of all unsecured debt / LTM revenue)', 2, leverageBands(), { autoApprove: '< 10%', autoReject: '>= 25%' }),
            ],
          },
          {
            id: 'restaurant_profile_seed',
            title: 'Restaurant Profile',
            criteria: [
              metric('effective_years_operations_financial', 'Effective Years of Operations', 3, yearsOfOperationsBands(), { autoApprove: '> 7', autoReject: '< 1' }),
            ],
          },
        ],
      },
      {
        id: 'non_core_financials',
        title: 'Non-Core Financials',
        aggregateWeight: null,
        categories: [
          {
            id: 'bank_revenue_volatility_trend',
            title: 'BANK: Revenue, Volatility and Trend Analysis (Financial Health)',
            criteria: [
              metric('bank_12m_avg_monthly_sales', 'BANK: 12 Months Average Monthly Sales Size', 6, salesSizeBands(), { autoReject: '< 210,000' }),
              metric('bank_average_balance_to_revenue', 'BANK: Average Balance to Revenue (Last 12 Months)', 4, [
                band(0, '< 5%'),
                band(25, '>= 5% and < 7%'),
                band(50, '>= 7% and < 10%'),
                band(75, '>= 10% and < 12%'),
                band(100, '>= 12%'),
              ], { autoApprove: '>= 12%', autoReject: '< 5%' }),
              metric('bank_average_revenue_generating_credit_size', 'BANK: Average Revenue Generating Credit Size', 3, [
                band(0, '< 150'),
                band(25, '>= 150 and < 250'),
                band(50, '>= 250 and < 350'),
                band(75, '>= 350 and < 500'),
                band(100, '>= 500'),
              ], { autoApprove: '>= 250' }),
              metric('bank_revenue_corroboration_to_vat', 'BANK: Revenue Corroboration to VAT', 3, percentAscendingBands(70, 80, 90, 100), { autoApprove: '>= 70%', autoReject: '< 70%' }),
              metric('bank_delivery_vs_dine_in', 'BANK: Delivery vs Dine In', 3, deliveryMixBands(), { autoReject: '> 35%' }),
              metric('bank_coefficient_of_variation', 'BANK: Coefficient of Variation (CV)', 2, [
                band(0, '> 0.35'),
                band(25, '>= 0.22 and < 0.35'),
                band(50, '>= 0.15 and < 0.22'),
                band(75, '>= 0.08 and < 0.15'),
                band(100, '< 0.08'),
              ], { autoReject: '> 0.35' }),
              metric('bank_rent_to_revenue_ratio', 'BANK: Rent to Revenue Ratio', 5, rentBands(), { autoReject: '> 15%' }),
            ],
          },
        ],
      },
      {
        id: 'profile',
        title: 'Profile',
        aggregateWeight: 30,
        categories: [
          {
            id: 'restaurant_profile',
            title: 'Restaurant Profile',
            criteria: [
              metric('effective_years_operations', 'Effective Years of Operations', 6, yearsOfOperationsBands(), { autoApprove: '> 7', autoReject: '< 1' }),
              metric('entity_structure', 'Entity Structure', 4, [
                band(30, 'Standalone Entity'),
                band(60, 'Small Group (2-4 venues)'),
                band(100, 'Established Group'),
              ]),
              metric('api_readiness', 'API Readiness', 4, [
                band(0, 'NO'),
                band(100, 'YES'),
              ]),
              metric('location_tier', 'Location Tier', 7, [
                band(25, 'Far outlying areas, poorly accessible locations, others'),
                band(50, 'Jebel Ali, Dubai Investment Park, Al Quoz (non-Alserkal), JLT, Sports City, Jumeirah residential streets, Motor City, Discovery Gardens, Dubai Mall'),
                band(75, 'Business Bay, Dubai Marina, Dubai Harbour, Bluewaters, JBR Walk, La Mer'),
                band(100, 'Mall of Emirates, DIFC, City Walk, International City, Dubai Mall prime'),
              ]),
              metric('seat_turnover_rate', 'Seat Turnover Rate', 6, [
                band(25, '< 1x'),
                band(75, '1x - 2x'),
                band(100, '>= 2x'),
              ]),
              metric('venue_type', 'Venue Type', 5, [
                band(25, 'Outdoor/Terrace Primary'),
                band(75, 'Standalone Indoor'),
                band(100, 'Mall/Hotel Linked'),
              ]),
              metric('weighted_average_ratings', 'Weighted Avg Ratings', 8, [
                band(0, '< 2.5'),
                band(25, '>= 2.6 and < 3.0'),
                band(50, '>= 3.1 and < 4.0'),
                band(75, '>= 4.1 and < 4.5'),
                band(100, '>= 4.6 and <= 5.0'),
              ], { autoApprove: '>= 4.5 and <= 5', autoReject: '>= 0 and < 2.5' }),
              metric('google_review_integrity', 'Google Review Integrity', 8, [
                band(30, '< 50'),
                band(60, '>= 50 and < 60'),
                band(100, '>= 60'),
              ], { autoApprove: '> 60' }),
            ],
          },
          {
            id: 'brand_strength',
            title: 'Brand Strength',
            criteria: [
              metric('audience_reach_scale', 'Audience Reach and Scale', 10, [
                band(20, '0.20'),
                band(40, '0.40'),
                band(70, '0.70'),
                band(100, '1.00'),
              ]),
              metric('engagement_quality', 'Engagement Quality', 6, digitalMaturityBands(), { autoApprove: '> 0.80' }),
              metric('content_consistency_recency', 'Content Consistency and Recency', 6, digitalMaturityBands(), { autoApprove: '> 0.80' }),
              metric('digital_footprint_maturity', 'Digital Footprint Maturity', 4, digitalMaturityBands()),
              metric('traction_indicator', 'Traction Indicator', 6, [
                band(40, '0 - 2'),
                band(70, '2 - 4'),
                band(100, '5'),
              ], { autoApprove: '= 5' }),
            ],
          },
          {
            id: 'customer_experience_mystery_shopping',
            title: 'Customer Experience - Mystery Shopping',
            criteria: [
              mysteryMetric('service_quality_responsiveness', 'Service quality and responsiveness'),
              mysteryMetric('food_quality_presentation_menu', 'Food quality, presentation, and menu execution'),
              mysteryMetric('cleanliness_ambience', 'Cleanliness and overall ambience'),
              mysteryMetric('brand_positioning_pricing_consistency', 'Consistency with stated brand positioning and pricing'),
            ],
          },
        ],
      },
    ],
    capCriteria: [
      capMetric('credit_score', 'Credit Score', 0.5, [
        capBand('>= 745', 100),
        capBand('>= 710 and < 745', 90),
        capBand('>= 650 and < 710', 70),
        capBand('>= 540 and < 650', 50),
        capBand('>= 1 and < 540', 0),
        capBand('No History', 50),
      ]),
      capMetric('unsecured_loans_last_6', '# of Un-Secured Loans Last 6', 1, [
        capBand('0 Loan with 6 Month Credit History', 100),
        capBand('1 Loan in Last 6 Month', 80),
        capBand('2 Loans in Last 6 Month', 60),
        capBand('3 Loans in Last 6 Month', 0),
        capBand('No Historic Loan', 50),
      ]),
      capMetric('loan_exposure', 'Loan Exposure', 1, [
        capBand('< 5% of LTM Revenues', 100),
        capBand('5% - 10% of LTM Revenues', 80),
        capBand('10% - 15%', 50),
        capBand('> 15%', 0),
        capBand('No History', 50),
      ]),
      capMetric('credit_utilization_ratio', 'Credit Utilization Ratio', 1, [
        capBand('< 70%', 100),
        capBand('70% - 80%', 70),
        capBand('80% - 90%', 50),
        capBand('> 90%', 0),
        capBand('No History', 50),
      ]),
      capMetric('loan_repayment_history', 'Loan Repayment History', 2, [
        capBand('> 12 Month', 100),
        capBand('6 Month - 12 Month', 80),
        capBand('3 Month - 6 Month', 50),
        capBand('0 Month - 3 Month', 30),
        capBand('No History', 50),
      ]),
      capMetric('delinquency_history', 'Delinquency History', 1.5, [
        capBand('No Overdue (Loan History: 6-12 months)', 100),
        capBand('No Overdue (Loan History: 0-6 months)', 70),
        capBand('1 Overdue Payment (30-60 Days)', 50),
        capBand('> 1 Overdue Payment (60-90 Days)', 0),
        capBand('>= 1 Overdue Payment (>90 Days)', 0),
        capBand('No History', 50),
      ]),
    ],
  },
  USA: {
    region: 'USA',
    version_label: SCORING_POLICY_VERSION,
    effective_date: '2026-06-12',
    currency: 'USD',
    methodology: 'USA draft model: Toast net sales, bank data, lease validity, and Mezza policy checks. Personal credit reports/FICO are excluded.',
    modelWeights: [
      { model: 'Financial', weight: 70 },
      { model: 'Restaurant Profile', weight: 30 },
    ],
    displayGradeBands: [
      { grade: 'A', min: 80, max: 100 },
      { grade: 'B+', min: 75, max: 79.999 },
      { grade: 'B', min: 70, max: 74.999 },
      { grade: 'C+', min: 65, max: 69.999 },
      { grade: 'NM', min: 0, max: 64.999 },
    ],
    scoringRangeLogic: [
      { label: 'No Score', score: 0 },
      { label: 'Low', score: 25 },
      { label: 'Medium', score: 50 },
      { label: 'High', score: 75 },
      { label: 'Very High', score: 100 },
    ],
    riskCategories: [
      { category: 'A+', min: 90, max: 100, ceiling: '5%', votesRequired: 1, refinancingThreshold: '75%' },
      { category: 'A', min: 80, max: 90, ceiling: '4%', votesRequired: 1, refinancingThreshold: '75%' },
      { category: 'B+', min: 70, max: 80, ceiling: '3%', votesRequired: 2, refinancingThreshold: '75%' },
      { category: 'B', min: 60, max: 70, ceiling: '2%', votesRequired: 2, refinancingThreshold: '100%' },
      { category: 'C+', min: 55, max: 60, ceiling: '1%', votesRequired: 3, refinancingThreshold: '100%' },
      { category: 'C', min: 50, max: 55, ceiling: '<=1%', votesRequired: 3, refinancingThreshold: '100%' },
      { category: 'No Match', min: 0, max: 49.999, ceiling: '-', votesRequired: '-', refinancingThreshold: '-' },
    ],
    sections: [
      {
        id: 'usa_financials',
        title: 'USA Financials',
        aggregateWeight: 70,
        categories: [
          {
            id: 'toast_revenue_quality',
            title: 'Toast Revenue, Volatility and Trend',
            criteria: [
              metric('toast_net_sales_ltm', 'Toast Net Sales - Last 12 Months', 10, [
                band(0, '< 750,000'),
                band(40, '>= 750,000 and < 1,500,000'),
                band(70, '>= 1,500,000 and < 3,000,000'),
                band(100, '>= 3,000,000'),
              ]),
              metric('toast_monthly_sales_volatility', 'Toast Monthly Sales Volatility', 6, [
                band(0, '> 0.35'),
                band(25, '>= 0.22 and < 0.35'),
                band(50, '>= 0.15 and < 0.22'),
                band(75, '>= 0.08 and < 0.15'),
                band(100, '< 0.08'),
              ]),
              metric('active_tender_mix', 'Active Tender Mix: Card / Cash / Delivery / Online', 5, [
                band(100, 'Clean electronic traceability and explainable delivery/online mix'),
                band(50, 'Partial traceability or concentration requiring review'),
                band(0, 'Unexplained cash or tender concentration'),
              ]),
            ],
          },
          {
            id: 'bank_lease_policy',
            title: 'Bank, Lease and Policy Checks',
            criteria: [
              metric('bank_revenue_corroboration', 'Bank Revenue Corroboration', 12, percentAscendingBands(70, 80, 90, 100)),
              metric('lease_validity', 'Lease Agreement / Tenancy Contract', 8, [
                band(100, 'Valid beyond underwriting window'),
                band(50, 'Expires inside 90-day cap window'),
                band(0, 'Missing or expired'),
              ]),
              metric('personal_credit_exclusion', 'Personal Credit/FICO Exclusion', 0, [
                band(100, 'Not requested, fetched, stored, or displayed'),
                band(0, 'Policy breach - human review'),
              ]),
            ],
          },
        ],
      },
      {
        id: 'usa_profile',
        title: 'USA Restaurant Profile',
        aggregateWeight: 30,
        categories: [
          {
            id: 'restaurant_profile',
            title: 'Restaurant Profile',
            criteria: [
              metric('effective_years_operations', 'Effective Years of Operations', 6, yearsOfOperationsBands()),
              metric('google_rating_review_integrity', 'Google Rating and Review Integrity', 8, [
                band(0, '< 3.5 or low review integrity'),
                band(50, '>= 3.5 and < 4.1'),
                band(75, '>= 4.1 and < 4.5'),
                band(100, '>= 4.5 with review integrity confirmed'),
              ]),
              metric('location_quality', 'Location Quality', 7, [
                band(25, 'Peripheral or low-footfall trade area'),
                band(50, 'Standard neighborhood trade area'),
                band(75, 'Strong dining corridor'),
                band(100, 'Prime high-footfall location'),
              ]),
            ],
          },
        ],
      },
    ],
    capCriteria: [],
  },
};

export function normalizeScoringRegion(region) {
  return String(region || '').toUpperCase() === 'USA' ? 'USA' : 'UAE';
}

export function clonePolicy(policy) {
  return JSON.parse(JSON.stringify(policy));
}

export function defaultPolicyForRegion(region) {
  return clonePolicy(DEFAULT_SCORING_POLICIES[normalizeScoringRegion(region)]);
}

export function normalizePolicyPayload(region, policy) {
  const normalizedRegion = normalizeScoringRegion(region || policy?.region);
  const source = policy && typeof policy === 'object' ? clonePolicy(policy) : defaultPolicyForRegion(normalizedRegion);
  source.region = normalizedRegion;
  source.version_label = String(source.version_label || SCORING_POLICY_VERSION);
  source.effective_date = String(source.effective_date || new Date().toISOString().slice(0, 10));
  source.currency = source.currency || (normalizedRegion === 'USA' ? 'USD' : 'AED');
  source.modelWeights = Array.isArray(source.modelWeights) ? source.modelWeights : [];
  source.displayGradeBands = Array.isArray(source.displayGradeBands) ? source.displayGradeBands : DEFAULT_SCORING_POLICIES[normalizedRegion].displayGradeBands;
  source.scoringRangeLogic = Array.isArray(source.scoringRangeLogic) ? source.scoringRangeLogic : DEFAULT_SCORING_POLICIES[normalizedRegion].scoringRangeLogic;
  source.riskCategories = Array.isArray(source.riskCategories) ? source.riskCategories : DEFAULT_SCORING_POLICIES[normalizedRegion].riskCategories;
  source.sections = Array.isArray(source.sections) ? source.sections : [];
  source.capCriteria = Array.isArray(source.capCriteria) ? source.capCriteria : [];
  return source;
}

export function gradeForScore(score, policy = DEFAULT_SCORING_POLICIES.UAE) {
  const value = Number(score);
  if (!Number.isFinite(value) || value <= 0) return '-';
  const bands = Array.isArray(policy?.displayGradeBands) ? policy.displayGradeBands : DEFAULT_SCORING_POLICIES.UAE.displayGradeBands;
  const match = bands.find((bandItem) => value >= Number(bandItem.min) && value <= Number(bandItem.max));
  return match?.grade || '-';
}

export function riskCategoryForScore(score, policy = DEFAULT_SCORING_POLICIES.UAE) {
  const value = Number(score);
  if (!Number.isFinite(value)) return null;
  const categories = Array.isArray(policy?.riskCategories) ? policy.riskCategories : DEFAULT_SCORING_POLICIES.UAE.riskCategories;
  return categories.find((category) => value >= Number(category.min) && value <= Number(category.max)) || null;
}

export function scoreLabel(score) {
  return SCORE_LABELS[Number(score)] || String(score);
}

function metric(id, label, weight, bands, extras = {}) {
  return { id, label, weight, bands, ...extras };
}

function band(score, range) {
  return { score, label: scoreLabel(score), range };
}

function capMetric(id, label, scoring, bands) {
  return { id, label, scoring, bands };
}

function capBand(range, weight) {
  return { range, weight };
}

function salesSizeBands() {
  return [
    band(0, '< 100,000'),
    band(25, '>= 100,000 and < 210,000'),
    band(50, '>= 210,000 and < 420,000'),
    band(75, '>= 420,000 and < 840,000'),
    band(100, '>= 840,000'),
  ];
}

function percentAscendingBands(a, b, c, d) {
  return [
    band(0, `< ${a}%`),
    band(25, `>= ${a}% and < ${b}%`),
    band(50, `>= ${b}% and < ${c}%`),
    band(75, `>= ${c}% and < ${d}%`),
    band(100, `>= ${d}%`),
  ];
}

function inversePercentBands(ranges) {
  return [
    band(100, ranges[0]),
    band(75, ranges[1]),
    band(50, ranges[2]),
    band(0, ranges[3]),
  ];
}

function rentBands() {
  return [
    band(0, '>= 15%'),
    band(25, '>= 12% and < 15%'),
    band(50, '>= 9% and < 12%'),
    band(75, '>= 6% and < 9%'),
    band(100, '< 5%'),
  ];
}

function deliveryMixBands() {
  return [
    band(100, '< 35%'),
    band(75, '>= 35% and < 50%'),
    band(50, '>= 50% and < 65%'),
    band(25, '>= 65% and < 80%'),
    band(0, '>= 80%'),
  ];
}

function leverageBands() {
  return [
    band(0, '>= 25%'),
    band(25, '>= 20% and < 25%'),
    band(50, '>= 15% and < 20%'),
    band(75, '>= 10% and < 15%'),
    band(100, '< 10%'),
  ];
}

function yearsOfOperationsBands() {
  return [
    band(0, '< 1'),
    band(25, '>= 1 and < 2'),
    band(50, '>= 2 and < 3'),
    band(75, '>= 3 and < 7'),
    band(100, '>= 7'),
  ];
}

function digitalMaturityBands() {
  return [
    band(40, '> 0.40 and <= 0.50'),
    band(70, '> 0.50 and <= 0.80'),
    band(100, '> 0.80 and <= 1.00'),
  ];
}

function mysteryMetric(id, label) {
  return metric(id, label, 5, [
    band(20, '1'),
    band(40, '2'),
    band(60, '3'),
    band(80, '4'),
    band(100, '5'),
  ]);
}
