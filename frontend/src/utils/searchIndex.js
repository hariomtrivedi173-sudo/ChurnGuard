import {
  LayoutDashboard,
  Users,
  Zap,
  UploadCloud,
  BarChart2,
  FileText,
  Layers,
  Settings as SettingsIcon,
  Bell,
  LogOut
} from 'lucide-react'

/**
 * Clean, extensible search index for all existing ChurnGuard routes & actions.
 * Ready for future extension (e.g. customer ID search, dataset search, etc.)
 */
export const NAVIGATION_SUGGESTIONS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'View customer churn analytics, KPIs & telemetry overview',
    path: '/dashboard',
    icon: LayoutDashboard,
    category: 'Pages',
    keywords: [
      'dash', 'dashboard', 'board', 'home', 'kpi', 'metrics',
      'overview', 'churn rates', 'analytics overview', 'stats',
      'telemetry', 'realtime', 'summary'
    ]
  },
  {
    id: 'customers',
    label: 'Customers',
    description: 'View and manage customer dataset, churn risk profiles & filters',
    path: '/customers',
    icon: Users,
    category: 'Pages',
    keywords: [
      'cust', 'customers', 'customer', 'customer list', 'users',
      'accounts', 'clients', 'profiles', 'directory', 'list',
      'tenure', 'contract', 'mrr'
    ]
  },
  {
    id: 'predict',
    label: 'Predict Churn',
    description: 'Analyze customer churn risk & run AI/ML predictions',
    path: '/predict',
    icon: Zap,
    category: 'Features',
    keywords: [
      'pred', 'predict', 'prediction', 'predictions', 'churn risk',
      'ai', 'ml', 'risk score', 'forecast', 'scoring', 'model',
      'simulation', 'single customer'
    ]
  },
  {
    id: 'upload',
    label: 'Upload Dataset',
    description: 'Upload customer CSV data & retrain intelligence models',
    path: '/upload',
    icon: UploadCloud,
    category: 'Features',
    keywords: [
      'upl', 'upload', 'upload dataset', 'dataset', 'csv', 'import',
      'data', 'file', 'batch', 'train', 'ingest'
    ]
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Explore customer churn distributions, tenure & behavior charts',
    path: '/analytics',
    icon: BarChart2,
    category: 'Pages',
    keywords: [
      'analytics', 'charts', 'graphs', 'distributions', 'metrics',
      'stats', 'cohorts', 'visualizations', 'tenure', 'breakdown',
      'trends'
    ]
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Generate, customize and export churn executive reports & CSV',
    path: '/reports',
    icon: FileText,
    category: 'Pages',
    keywords: [
      'rep', 'reports', 'report', 'export', 'pdf', 'csv',
      'executive report', 'summary', 'download', 'statement',
      'audit'
    ]
  },
  {
    id: 'segments',
    label: 'Segments',
    description: 'Analyze customer cohorts, risk clusters & retention segments',
    path: '/segments',
    icon: Layers,
    category: 'Pages',
    keywords: [
      'seg', 'segments', 'cohorts', 'clusters', 'groups',
      'tiers', 'retention', 'behavioral'
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Configure enterprise workspace, security, profile & appearance',
    path: '/settings',
    icon: SettingsIcon,
    category: 'Account',
    keywords: [
      'set', 'settings', 'config', 'preferences', 'profile',
      'security', 'theme', 'appearance', 'password', 'account',
      'dark mode', 'enterprise'
    ]
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'View system alerts, batch prediction updates & telemetry logs',
    action: 'notifications',
    icon: Bell,
    category: 'Quick Actions',
    keywords: [
      'not', 'notifications', 'alerts', 'updates', 'messages',
      'inbox', 'bell', 'system'
    ]
  },
  {
    id: 'logout',
    label: 'Logout',
    description: 'Sign out of your ChurnGuard enterprise session',
    action: 'logout',
    icon: LogOut,
    category: 'Account',
    keywords: [
      'log', 'logout', 'sign out', 'exit', 'disconnect',
      'leave', 'session'
    ]
  }
]

/**
 * Filter and rank suggestions against the search query.
 * Flexible search matching against label, keywords, description, path.
 */
export function getSuggestions(query = '') {
  const q = query.trim().toLowerCase()
  if (!q) {
    // Top 6 default suggestions when search is focused but empty
    return NAVIGATION_SUGGESTIONS.slice(0, 6)
  }

  const scored = []

  for (const item of NAVIGATION_SUGGESTIONS) {
    const labelLower = item.label.toLowerCase()
    const descLower = item.description.toLowerCase()
    const pathLower = (item.path || '').toLowerCase()
    const keywords = item.keywords || []

    let score = 0

    // Exact label or exact keyword match
    if (labelLower === q || keywords.some(k => k === q)) {
      score += 150
    }
    // Label starts with query
    else if (labelLower.startsWith(q)) {
      score += 100
    }
    // Keyword starts with query
    else if (keywords.some(k => k.startsWith(q))) {
      score += 90
    }
    // Label contains query (e.g. "board" in "Dashboard")
    else if (labelLower.includes(q)) {
      score += 80
    }
    // Keyword contains query
    else if (keywords.some(k => k.includes(q))) {
      score += 70
    }
    // Path contains query
    else if (pathLower && pathLower.includes(q)) {
      score += 60
    }
    // Description contains query
    else if (descLower.includes(q)) {
      score += 30
    }

    // Multi-word matching
    const words = q.split(/\s+/).filter(Boolean)
    if (words.length > 1) {
      const allWordsMatch = words.every(w =>
        labelLower.includes(w) ||
        descLower.includes(w) ||
        keywords.some(k => k.includes(w))
      )
      if (allWordsMatch) {
        score += 50
      }
    }

    if (score > 0) {
      scored.push({ item, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.item)
}
