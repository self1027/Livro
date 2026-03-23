const sequelize = require('sequelize') 
const connection = require('../../database/database.js') 
const slugify = require('slugify') 

const district = connection.define('districts', {
	name: {
		type: sequelize.STRING,
		allowNull: false
	},
	slug: {
		type: sequelize.STRING,
		allowNull: false,
		unique: true
	},
	created_at: {
		type: sequelize.DATE,
		defaultValue: sequelize.NOW
	},
	updated_at: {
		type: sequelize.DATE,
		defaultValue: sequelize.NOW
	}
}, {
	hooks: {
		beforeCreate: (district) => {
			district.slug = slugify(district.name, {
				lower: true,
				strict: true,
				locale: 'pt'
			}) 
		},
		beforeUpdate: (district) => {
			district.slug = slugify(district.name, {
				lower: true,
				strict: true,
				locale: 'pt'
			}) 
		}
	}
}) 

district.sync() 

module.exports = district 