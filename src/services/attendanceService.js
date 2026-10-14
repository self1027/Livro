import fs from 'fs/promises'
import path from 'path'

const FILE_PATH = path.resolve('src/data/attendance.json')

console.log('Attendance service initialized with file:', FILE_PATH)

const DEFAULT = {
    enabled: true,
    weekdays: [],
    paused: false,
    updated_at: null
}

export function createAttendanceService(filePath = FILE_PATH) {
    async function read() {
        try {
            const data = await fs.readFile(filePath, 'utf-8')
            const parsed = JSON.parse(data)
            return {
                enabled: parsed.enabled !== false,
                weekdays: Array.isArray(parsed.weekdays) ? parsed.weekdays.filter(day => ['SEG', 'TER', 'QUA', 'QUI', 'SEX'].includes(day)) : [],
                paused: parsed.paused === true,
                updated_at: parsed.updated_at || null
            }
        } catch {
            return DEFAULT
        }
    }

    async function write(data) {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    }

    async function get() {
        return await read()
    }

    async function update({ weekdays, paused, enabled }) {
        const data = await read()
        const moduleEnabled = enabled == null ? data.enabled : enabled !== false

        const newData = {
            ...data,
            enabled: moduleEnabled,
            weekdays: !moduleEnabled ? data.weekdays : Array.isArray(weekdays) ? [...new Set(weekdays.filter(day => ['SEG', 'TER', 'QUA', 'QUI', 'SEX'].includes(day)))] : [],
            paused: !moduleEnabled ? data.paused : !!paused,
            updated_at: new Date().toISOString()
        }

        await write(newData)

        return newData
    }

    return { get, update }
    }
    export default createAttendanceService()
