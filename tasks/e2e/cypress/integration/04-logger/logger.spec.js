/* eslint-disable no-undef, camelcase */
/// <reference types="cypress" />
import path from 'path'

import { setupLogger } from './codemods/Step0_1_Setup_Logger'
import Step2_Add_Logger from './codemods/Step2_1_Add_Logger_to_Posts'

const BASE_DIR = Cypress.env('RW_PATH')
const LOG_FILENAME = 'e2e.log'

describe('The Redwood Logger - Basic Scaffold CRUD Logging', () => {
  afterEach(() => {
    cy.reload()
  })

  it('0. Setup Logging', () => {
    cy.writeFile(
      path.join(BASE_DIR, 'api/src/lib/logger.js'),
      setupLogger(BASE_DIR, LOG_FILENAME)
    )

    cy.visit('http://localhost:8910')

    cy.readFile(path.join(BASE_DIR, LOG_FILENAME)).should('exist')
  })

  it('1. Test Logging for CRUD', () => {
    cy.writeFile(
      path.join(BASE_DIR, 'api/src/services/posts/posts.js'),
      Step2_Add_Logger
    )

    cy.visit('http://localhost:8910/posts')

    cy.readFile(path.join(BASE_DIR, LOG_FILENAME)).should('contain', 'Starting')

    cy.readFile(path.join(BASE_DIR, LOG_FILENAME)).should(
      'contain',
      '> in posts()'
    )
    // CREATE / SAVE
    cy.contains(' New Post').click()
    cy.get('input#title').type('First post')
    cy.get('input#body').type('Hello world!')
    cy.get('button').contains('Save').click()

    cy.readFile(path.join(BASE_DIR, LOG_FILENAME)).should(
      'contain',
      '> in createPost()'
    )

    cy.readFile(path.join(BASE_DIR, LOG_FILENAME)).should(
      'contain',
      'Hello world!'
    )

    // EDIT
    cy.contains('Edit').click()

    cy.get('input#body').clear().type('No, Margle the World!')
    cy.get('button').contains('Save').click()

    cy.readFile(path.join(BASE_DIR, LOG_FILENAME)).should(
      'contain',
      '> in updatePost()'
    )

    cy.readFile(path.join(BASE_DIR, LOG_FILENAME)).should(
      'contain',
      'No, Margle the World'
    )

    // DELETE
    cy.contains('Delete').click()

    cy.readFile(path.join(BASE_DIR, LOG_FILENAME)).should(
      'contain',
      '> in deletePost()'
    )
  })
})
