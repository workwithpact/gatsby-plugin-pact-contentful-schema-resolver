# gatsby-plugin-pact-contentful-schema-resolver

We've built a (small) [Contentful app](https://github.com/workwithpact/Pact-Contentful-Shopify-Schemas) that allows extending fields using [Shopify's settings schema](https://shopify.dev/themes/architecture/settings/input-settings).

This Gatsby plugin allows querying section settings on any contentful type.

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
