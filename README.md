# gatsby-plugin-pact-contentful-schema-resolver

We've built a (small) [Contentful app](https://github.com/workwithpact/Pact-Contentful-Shopify-Schemas) that allows extending fields using [Shopify's settings schema](https://shopify.dev/themes/architecture/settings/input-settings).

This Gatsby plugin allows querying section settings (and blocks!) on any contentful type.

## Features
- Ability to query sections by id (field)
- Ability to query blocks by type within a section
- Ability to gather setting values (for either sections or blocks) as text, boolean, number or node
- Ability to gather setting values (for either sections or blocks) as an existing ContentfulType (ex: you have a `blogPost` type and linked a `blogPost` entry to a setting using the Contentful app, you're able to request the value as a true `ContentfulBlogPost` from GraphQL)


## Why ?
While the JSON fields are automatically exposed as GraphQL nodes, once you change data in contentful, you risk making queries on inexistent fields.
This plugin solves that by exposing an array of fields as opposed to fields.

## Prerequisites
This plugin assumes you are using the [gatsby-source-contentful](https://www.gatsbyjs.com/plugins/gatsby-source-contentful/) plugin (or any plugin utilizing this under the hood)

This plugin also assumes your Contentful space has the following Content Model and definitons:

```json
{
  "name": "Custom Field Definitions",
  "description": "",
  "displayField": "title",
  "fields": [
    {
      "id": "title",
      "name": "Title",
      "type": "Symbol",
      "localized": false,
      "required": false,
      "validations": [],
      "disabled": false,
      "omitted": false
    },
    {
      "id": "models",
      "name": "Content models and field",
      "type": "Array",
      "localized": false,
      "required": true,
      "validations": [],
      "disabled": false,
      "omitted": false,
      "items": {
        "type": "Symbol",
        "validations": [
          {
            "regexp": {
              "pattern": "^([a-zA-Z0-9_-]+|\\*):([a-zA-Z0-9_-]+)$",
              "flags": null
            },
            "message": "Please use the contentId:fieldId format"
          }
        ]
      }
    },
    {
      "id": "config",
      "name": "Configuration",
      "type": "Object",
      "localized": false,
      "required": false,
      "validations": [],
      "disabled": false,
      "omitted": false
    }
  ],
  "sys": {
    "id": "pactSectionsDefinitions",
    "type": "ContentType",
  }
}
```

If you're using our Contentful App, then this is likely already the case :-)

## Installation
First, you'll want to install the package through either npm or yarn:
- Are you using npm? A simple `npm install @workwithpact/pact-contentful-schema-gatsby --save` will suffice!
- Or are you more of a yarn type of person? `yarn add @workwithpact/pact-contentful-schema-gatsby` will get the job done.

Next, you'll want to open up your `gatsby-config.js` file and add `@workwithpact/pact-contentful-schema-gatsby` to the array of plugins. Anywhere within the array works, we're not picky.

Here's what it would look like:

```javascript
module.exports = {
  ...stuff,
  plugins: [
    ...somePlugins,
    {
      resolve: `gatsby-source-contentful`,
      options: {
        ...contentfulOptions
      },
    },
    `@workwithpact/pact-contentful-schema-gatsby`,
    ...maybeSomeMorePlugins
  ]
}
```


## Querying for settings and blocks

The easiest way to query for all sections and their settings (and blocks) is to use the `sections` field and its child `settings` (or `blocks`).
We suggest you take a very quick glance at the [type definitions](https://github.com/workwithpact/gatsby-plugin-pact-contentful-schema-resolver/blob/main/gatsby-node.js#L22-L67) created by this plugin before proceeding, to familiarize yourself with how content is exposed.

### Querying all settings of a section, using `... on`

```gql
  AllContentfulSomeType {
    sections {
      id
      name
      settings {
        ... on PactSectionSettingString {
          id
          value
        }
        ... on PactSectionSettingNumber {
          id
          value
        }
        ... on PactSectionSettingBoolean {
          id
          value
        }
        ... on PactSectionSettingNode {
          id
          value {
           ...
          }
        }
      }
    }
  }
```
### Querying a specific setting for a specific section, using `section(id:"field")` and `setting:(id:"key")`

```gql
  AllContentfulSomeType {
    section(id: "data") {
      mySetting: setting(id: "title") {
        ... on PactSectionSettingString {
          value
        }
      }
    }
  }
```

### Querying a specific setting as text for a specific section, using `section(id:"field")` and `settingValueAsText:(id:"key")`

```gql
  AllContentfulSomeType {
    section(id: "data") {
      mySetting: settingValueAsText(id: "title")
    }
  }
```

### Querying a specific setting as an asset for a specific section, using `section(id:"field")` and `settingValueAsContentfulAsset:(id:"key")`

```gql
  AllContentfulSomeType {
    section(id: "data") {
      mySetting: settingValueAsContentfulAsset(id: "image") {
        width
        height
      }
    }
  }
```

### Querying blocks
```gql
  AllContentfulSomeType {
    section(id: "data") {
      blocks {
        type
        name
        index
        settings {
          .. on PactSectionSettingString {
            value
            id
          }
        }
      }
    }
  }
```

### Querying blocks of a specific type
```gql
  AllContentfulSomeType {
    section(id: "data") {
      blocksOfType(type:"hero") { 
        type
        name
        index
        settings {
          .. on PactSectionSettingString {
            value
            id
          }
        }
      }
    }
  }
```
## Other things you can do
We're getting a little tired of writing GraphQL examples with data you can't access in our Contentful. 
The best way to understand it all is to play with the plugin.

Can you query a block's settings by id, as a specific GraphQL Type? Try it ou! (pssst: the answer's yes)