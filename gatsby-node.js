/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.com/docs/node-apis/
 */
// You can delete this file if you're not using it

/**
 * You can uncomment the following line to verify that
 * your plugin is being loaded in your site.
 *
 * See: https://www.gatsbyjs.com/docs/creating-a-local-plugin/#developing-a-local-plugin-that-is-outside-your-project
 */
exports.onPreInit = () => console.log("Loaded gatsby-starter-plugin")

const knownDefinitions = [];
const knownTypes = {};

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions
  const typeDefs = `
    type PactSection {
      id: String!
      name: String
      models: [String!]!
      configJson: String
      settings: [PactSectionSetting!]!
    }
    
    union PactSectionSetting = PactSectionSettingNumber | PactSectionSettingString | PactSectionSettingBoolean | PactSectionSettingNode

    interface PactSectionSettingDefault {
      id: String!
    }

    type PactSectionSettingNumber implements PactSectionSettingDefault {
      id: String!
      value: Float
    }

    type PactSectionSettingString implements PactSectionSettingDefault {
      id: String!
      value: String
    }

    type PactSectionSettingBoolean implements PactSectionSettingDefault {
      id: String!
      value: Boolean
    }

    type PactSectionSettingNode implements PactSectionSettingDefault {
      id: String!
      value: ContentfulEntry
    }

    type PactSectionSettingAsset implements PactSectionSettingDefault {
      id: String!
      value: ContentfulAsset
    }
  `
  createTypes(typeDefs)
}

exports.createResolvers = ({ createResolvers, intermediateSchema }, pluginOptions) => {
  let knownDefinitions = null;
  const seenDefinitions = {};
  const contentfulTypes = Object.keys(intermediateSchema._typeMap)
    .filter(type => type.startsWith('Contentful') && type.endsWith('Sys'))
    .map(type => type.substring(0, type.length - 3).split('SysContentType').shift() + '')
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .filter(v => !intermediateSchema._implementationsMap[v]) //&& intermediateSchema._typeMap[`${v}Fields`])
  console.log('createResolvers!!!', contentfulTypes)
  const resolvers = {
   
  };
  contentfulTypes.forEach(type => {
    console.log('Type: ', type)
    resolvers[type] = {
      sections: {
        type: [`PactSection`],
        resolve: async (source, args, context, info) => {
          if (knownDefinitions === null) {
            const definitions = await context.nodeModel.findAll({ type: "ContentfulPactSectionsDefinitions"});
            knownDefinitions = [];
            for(const def of definitions.entries) {
              const { title, models, id } = def;
              if (seenDefinitions[id]) {
                continue;
              }
              const config = def.config___NODE ? await context.nodeModel.getNodeById({ id: def.config___NODE }) : null;
              knownDefinitions.push({
                title,
                models,
                config,
                id
              });
              seenDefinitions[id] = true;
            }
          }
          const matchingDefinitions = knownDefinitions.filter(def => {
            return def.models.find((model) => {
              const [type, field] = `${model}`.split(':');
              return ['*', source?.sys?.contentType?.sys?.id].includes(type) && source && source[`${field}___NODE`]
            });
          })
          const returnValues = [];
          for(const def of matchingDefinitions) {
            const { title, models, config, id } = def;
            const model = def.models.find((model) => {
              const [type, field] = `${model}`.split(':');
              return ['*', source?.sys?.contentType?.sys?.id].includes(type) && source && source[`${field}___NODE`]
            });
            const [type, field] = `${model}`.split(':');
            const fieldValue = await context.nodeModel.getNodeById({ id: source[`${field}___NODE`] });
            console.log({
              fieldValue,
              def
            })
            const section = {
              id: field,
              name: def.title,
              models: def.models,
              configJson: def?.config?.internal?.content || '{}',
              settings: [],
              blocks: []
            }
            const originalFieldValue = JSON.parse(fieldValue?.internal?.content || '{}');
            const entries = Object.entries(originalFieldValue?.settings || {})
            console.log({
              entries,
              originalFieldValue
            })
            for(const [key, value] of entries) {
              let type = 'PactSectionSettingNode'
              const matchingSetting = (config?.settings || []).find(setting => setting.id === key);
              switch(matchingSetting?.type) {
                case 'number':
                case 'range':
                  type = 'PactSectionSettingNumber';
                  break;
                case 'checkbox':
                  type = 'PactSectionSettingBoolean';
                  break;
                case 'text':
                case 'textarea':
                case 'richtext':
                case 'select':
                case 'radio':
                case 'url':
                case 'email':
                case 'search':
                case 'password':
                case 'tel':
                case 'date':
                case 'time':
                case 'datetime':
                case 'color':
                  type = 'PactSectionSettingString';
                  break;
              }
              let finalValue = value;
              if (type === 'PactSectionSettingNode' || type === 'PactSectionSettingAsset') {
                finalValue = await context.nodeModel.getNodeById({ id: value });
              } else if (type === 'PactSectionSettingBoolean') {
                finalValue = !!value
              } 
              else if(type === 'PactSectionSettingNumber') {
                finalValue = parseFloat(value)
              }
              const currentSetting = {
                id: key,
                value: finalValue,
                internal: {
                  type
                }
              }
              section.settings.push(currentSetting);
            }
            returnValues.push(section);
          }
          console.log({
            source,
            args,
            context,
            info
          })
          return returnValues;
        },
      }
    }
  });
  console.log(resolvers)
  createResolvers(resolvers);
};

exports.onCreateNode = function onCreateNode({ actions, node }) {
  // console.log('NODE CREATION!', node && node.internal && node.internal.type)
  if (node?.internal?.type === 'ContentfulPactSectionsDefinitions') {
    knownDefinitions.push(node);
    console.log('Adding node field!')
    actions.createNodeField({
      node,
      name: 'sections',
      value: []
    })
    
  } else if(node?.internal?.type === 'contentfulPactSectionsDefinitionsConfigJsonNode') {
    try {
      const def = knownDefinitions.find(def => def.id === node.parent)
      if (def) {
        def.config = JSON.parse(node.internal.content)
      }
    } catch(e) {
      console.error(e)
    }
  } else if (node?.sys?.contentType?.sys?.id) {
    const contentfulType = node.sys.contentType.sys.id;
    const gatsbyType = node?.internal?.type
    knownTypes[contentfulType] = gatsbyType;
    actions.createNodeField({
      node,
      name: 'sections',
      value: []
    })
  }
}

exports.setFieldsOnGraphQLNodeType = ({ type, getNodesByType }) => {
  // console.log(`setFieldsOnGraphQLNodeType`, type);
  const matchingDefinitions = knownDefinitions.filter(def => {
    console.log(def)
  });
  return {};
}

exports.onPreBootstrap = ({ actions, createNodeId, createContentDigest }) => {
  const { createNode } = actions
  console.log('SOURCENODE CALLED!!!')
}