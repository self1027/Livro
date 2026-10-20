import defaults from '../data/catalogDefaults.json' with {type:'json'}
import REPORT_TYPE, { REPORT_DETAILS } from '../constants/reportType.js'

export const catalogDefaults = defaults.filter(row => row.kind !== 'report')
export const statuses = Object.create(null)
export const senders = Object.create(null)
export const senderDetails = Object.create(null)
export const reportTypes = REPORT_TYPE
export const reportDetails = REPORT_DETAILS

// Keep object identities: existing imports receive database updates without a restart.
export function applyCatalog(rows) {
    for (const map of [statuses, senders, senderDetails]) {
        for (const key of Object.keys(map)) delete map[key]
    }
    for (const row of rows) {
        if (row.kind === 'status') statuses[row.slug] = { ...row }
        if (row.kind === 'sender') {
            senders[row.slug] = row.label
            senderDetails[row.slug] = { ...row }
        }
    }
}
export const closedStatusSlugs = () => Object.values(statuses).filter(s => s.behavior === 'closed').map(s => s.slug)
export const isClosedStatus = slug => statuses[slug]?.behavior === 'closed'
applyCatalog(catalogDefaults)
