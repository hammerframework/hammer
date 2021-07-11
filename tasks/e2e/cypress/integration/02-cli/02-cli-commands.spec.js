/* eslint-disable no-undef, camelcase */
/// <reference types="cypress" />

const BASE_DIR = Cypress.env('RW_PATH')

describe('Check Redwood cli commands against tutorial', () => {
  // These tests aren't visual, as they only run on the CLI
  // Disable taking screenshots/videos for this spec
  before(() => {
    Cypress.config('record', false)
  })

  after(() => {
    Cypress.config('record', true)
  })
  it('Should run api tests successfully', () => {
    // Reset contacts service to initial state to pass tests
    cy.exec(`cd ${BASE_DIR}; yarn rw g sdl contact --force`)

    cy.exec(`cd ${BASE_DIR}; yarn rw test api --no-watch`)
      .its('code')
      .should('eq', 0)
  })

  it('Should run web tests successfully', () => {
    cy.exec(`cd ${BASE_DIR}; yarn rw test web --no-watch`)
      .its('code')
      .should('eq', 0)
  })

  it('Should run build successfully (no prerender)', () => {
    // Check if webpack build on web, and babel build on api
    // work correctly
    cy.exec(`cd ${BASE_DIR}; yarn rw build --no-prerender`)
      .its('code')
      .should('eq', 0)
  })

  it('Should prerender about and homepage', () => {
    // Check if prerender is working
    cy.exec(`cd ${BASE_DIR}; yarn rw prerender`).its('code').should('eq', 0)

    const WEB_DIST = `${BASE_DIR}/web/dist`

    // Check prerendered files are generated
    // Prerender prop added to routes in codemods/Step6_1_Routes.js
    cy.readFile(`${WEB_DIST}/index.html`).should('contain', 'Redwood Blog')
    cy.readFile(`${WEB_DIST}/about.html`).should(
      'contain',
      'This site was created to demonstrate my mastery of Redwood'
    )
  })
})
