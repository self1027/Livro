import { DataTypes } from 'sequelize'
import connection from '../database/database.js'

const CatalogEntry = connection.define('catalog_entries', {
    kind: { type: DataTypes.STRING(16), allowNull: false },
    slug: { type: DataTypes.STRING(100), allowNull: false },
    label: { type: DataTypes.STRING(120), allowNull: false },
    color: { type: DataTypes.STRING(7), allowNull: false },
    backgroundColor: { type: DataTypes.STRING(7), allowNull: false, field: 'background_color' },
    behavior: { type: DataTypes.STRING(16), allowNull: true },
    code: { type: DataTypes.INTEGER, allowNull: true, unique: true }
}, {
    underscored: true,
    indexes: [{ unique: true, fields: ['kind', 'slug'] }]
})
export default CatalogEntry
