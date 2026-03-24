import Sequelize from 'sequelize'
import connection from '../database/database.js'
import slugify from 'slugify'

const district = connection.define('districts', {
	name: {
		type: Sequelize.STRING,
		allowNull: false
	},
	slug: {
		type: Sequelize.STRING,
		allowNull: false,
		unique: true
	}
}, {
	timestamps: true,
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

export default district