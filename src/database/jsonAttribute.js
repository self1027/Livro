// MariaDB exposes JSON columns as LONGTEXT through the MySQL driver.
export function jsonAttribute(type, name, options = {}) {
    return {
        type,
        ...options,
        get() {
            const value = this.getDataValue(name)
            return typeof value === 'string' ? JSON.parse(value) : value
        }
    }
}
