const slugify = require('slugify')
const connection = require('../database/database')
const districtModel = require('./districtModel')

const districts = [

"Paranápolis",
"Parque Empresarial 1",
"Vila Rondon",
"Parque São Gabriel",
"Condomínio Norvic",
"Empresarial Guanabara",
"Vila Messias",
"Bairro São Francisco",
"Jardim Brasil",
"Jardim Santo Antônio",
"Parque Urubupungá",
"Jardim Santo Antônio",
"Bairro Village",
"Vila Botega",
"Ecoville",
"Alto dos Ipês",
"Jardim das Tulipas",
"Residencial Morada do Sol",
"Fazenda Santa Lúcia",
"Jardim Europa",
"Próvido Bernardoni",
"Jardim São Lourenço",
"Otávio Minholi",
"Loteamento Esmeralda",
"Bairro Bom Jesus",
"Bairro São João",
"Bairro Esmeralda",
"Jardim Pedrina",
"Bairro Figueira",
"Planalto",
"Pereira Jordão",
"Parque Morumbi",
"Bairro Stella Maris",
"Vila Peliciari",
"Centro",
"Centro Comercial",
"Bairro Antena",
"Jardim das Águas",
"Conj. Habitacional Antônio Ricardo Pegoraro",
"Bairro Banespinha",
"Conj. Habitacional Cunha Bueno",
"Parque Rio Sul",
"Álvaro Gasparelli",
"Nova Canaã",
"Set Jardim",
"Bairro Aeroporto",
"Bairro Integração",
"Barbaroto",
"Bairro da Pesa",
"Jardim Nova Esperança",
"Parque Industrial",
"Jardim Bandeirantes",
"Bairro Quinta dos Castanheiras",
"Residencial Água Viva",
"Jardim Bela Vista",
"Jardim Marin",
"Jardim Santa Cecília",
"Bairro Piscina",
"Bairro Morimoto",
"Vila Rica",
"Vila Mineira",
"Vila São Pedro"

]

async function seed() {

    try {

        await connection.authenticate()

        for (const name of districts) {

            const slug = slugify(name, {
                lower: true,
                strict: true,
                locale: 'pt'
            })

            await districtModel.findOrCreate({
                where: { slug },
                defaults: {
                    name,
                    slug
                }
            })

        }

        console.log("✅ Bairros inseridos com sucesso")

        process.exit()

    } catch (error) {

        console.error("❌ Erro ao inserir bairros:", error)
        process.exit()

    }

}

seed()