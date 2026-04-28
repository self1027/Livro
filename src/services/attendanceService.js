import fs from 'fs/promises'
import path from 'path'

const FILE_PATH = path.resolve('src/data/attendance.json')

console.log('Attendance service initialized with file:', FILE_PATH)

const DEFAULT = {
    weekdays: [],
    paused: false,
    updated_at: null
}

async function read() {
    try {
        const data = await fs.readFile(FILE_PATH, 'utf-8')
        return JSON.parse(data)
    } catch {
        return DEFAULT
    }
}

async function write(data) {
    await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2))
}

async function get() {
    return await read()
}

async function update({ weekdays, paused }) {
    const data = await read()

    const newData = {
        ...data,
        weekdays: Array.isArray(weekdays) ? weekdays : [],
        paused: !!paused,
        updated_at: new Date().toISOString()
    }

    await write(newData)

    return newData
}

export default {
    get,
    update
}