/* eslint-disable no-undef, camelcase */
/// <reference types="cypress" />
import path from 'path'

import Step1_1_Routes from '../01-tutorial/codemods/Step1_1_Routes'
import Step2_1_PagesHome from '../01-tutorial/codemods/Step2_1_PagesHome'
import Step2_2_PagesAbout from '../01-tutorial/codemods/Step2_2_PagesAbout'
import Step3_1_LayoutsBlog from '../01-tutorial/codemods/Step3_1_LayoutsBlog'
import Step3_2_Routes from '../01-tutorial/codemods/Step3_2_Routes'
import Step3_3_PagesHome from '../01-tutorial/codemods/Step3_3_PagesHome'
import Step3_4_PagesAbout from '../01-tutorial/codemods/Step3_4_PagesAbout'
import Step4_1_DbSchema from '../01-tutorial/codemods/Step4_1_DbSchema'
import Step5_1_ComponentsCellBlogPost from '../01-tutorial/codemods/Step5_1_ComponentsCellBlogPost'
import Step5_2_ComponentsCellBlogPostTest from '../01-tutorial/codemods/Step5_2_ComponentsCellBlogPostTest'
import Step5_3_PagesHome from '../01-tutorial/codemods/Step5_3_PagesHome'
import Step6_1_Routes from '../01-tutorial/codemods/Step6_1_Routes'
import Step6_2_BlogPostPage from '../01-tutorial/codemods/Step6_2_BlogPostPage'
import Step6_3_BlogPostCell from '../01-tutorial/codemods/Step6_3_BlogPostCell'
import Step6_3_BlogPostCellTest from '../01-tutorial/codemods/Step6_3_BlogPostCellTest'
import Step6_4_BlogPost from '../01-tutorial/codemods/Step6_4_BlogPost'
import Step6_4_BlogPostTest from '../01-tutorial/codemods/Step6_4_BlogPostTest'
import Step6_5_BlogPostsCell from '../01-tutorial/codemods/Step6_5_BlogPostsCell'
import Step6_5_BlogPostsCellMock from '../01-tutorial/codemods/Step6_5_BlogPostsCellMock'
import Step7_1_BlogLayout from '../01-tutorial/codemods/Step7_1_BlogLayout'
import Step7_2_ContactPage from '../01-tutorial/codemods/Step7_2_ContactPage'
import Step7_3_Css from '../01-tutorial/codemods/Step7_3_Css'
import Step7_4_Routes from '../01-tutorial/codemods/Step7_4_Routes'
import Step8_1_ContactPageWithoutJsEmailValidation from '../01-tutorial/codemods/Step8_1_ContactPageWithoutJsEmailValidation'
import Step9_1_RequireAuth from '../01-tutorial/codemods/Step9_1_RequireAuth'
import Step9_2_PostsRequireAuth from '../01-tutorial/codemods/Step9_2_PostsRequireAuth'
import Step9_3_DisableAuth from '../01-tutorial/codemods/Step9_3_DisableAuth'

import Step0_1_RedwoodToml from './codemods/Step0_1_RedwoodToml'
import Step0_2_GraphQL from './codemods/Step0_2_GraphQL'
import Step8_2_CreateContactServiceValidation from './codemods/Step8_2_CreateContactServiceValidation'

const BASE_DIR = Cypress.env('RW_PATH')

describe('The Redwood Tutorial - Golden path Helix/Envelop edition', () => {
  // TODO: https://redwoodjs.com/tutorial/saving-data
  // TODO: https://redwoodjs.com/tutorial/administration
  before(() => {
    cy.exec(`cd ${BASE_DIR}; git restore . && git clean -df`, {
      failOnNonZeroExit: false,
    })
  })

  it('0. Starting Development', () => {
    // reset redwood toml to use envelop
    cy.writeFile(path.join(BASE_DIR, 'redwood.toml'), Step0_1_RedwoodToml)

    // reset graphql function to use envelop
    cy.writeFile(
      path.join(BASE_DIR, 'api/src/functions/graphql.js'),
      Step0_2_GraphQL
    )

    // https://redwoodjs.com/tutorial/installation-starting-development
    cy.writeFile(path.join(BASE_DIR, 'web/src/Routes.js'), Step1_1_Routes)
    cy.visit('http://localhost:8910')
    cy.get('h1 > span').contains('Welcome to RedwoodJS!')
  })

  it('1. Our First Page', () => {
    //redwoodjs.com/tutorial/our-first-page
    cy.visit('http://localhost:8910')
    cy.exec(`cd ${BASE_DIR}; yarn redwood generate page home / --force`)
    cy.get('h1').should('contain', 'HomePage')
  })

  it('2. A Second Page and a Link', () => {
    // https://redwoodjs.com/tutorial/a-second-page-and-a-link
    cy.exec(`cd ${BASE_DIR}; yarn redwood generate page about --force`)
    cy.writeFile(
      path.join(BASE_DIR, 'web/src/pages/HomePage/HomePage.js'),
      Step2_1_PagesHome
    )
    cy.contains('About').click()
    cy.get('h1').should('contain', 'AboutPage')
    cy.writeFile(
      path.join(BASE_DIR, 'web/src/pages/AboutPage/AboutPage.js'),
      Step2_2_PagesAbout
    )
    cy.get('h1').should('contain', 'Redwood Blog')
    cy.contains('Return home').click()
  })

  it('3. Layouts', () => {
    cy.exec(`cd ${BASE_DIR}; yarn redwood generate layout blog --force`)
    cy.writeFile(
      path.join(BASE_DIR, 'web/src/layouts/BlogLayout/BlogLayout.js'),
      Step3_1_LayoutsBlog
    )
    cy.writeFile(path.join(BASE_DIR, 'web/src/Routes.js'), Step3_2_Routes)
    cy.writeFile(
      path.join(BASE_DIR, 'web/src/pages/HomePage/HomePage.js'),
      Step3_3_PagesHome
    )
    cy.contains('Redwood Blog').click()
    cy.get('main').should('contain', 'Home')

    cy.writeFile(
      path.join(BASE_DIR, 'web/src/pages/AboutPage/AboutPage.js'),
      Step3_4_PagesAbout
    )
    cy.contains('About').click()
    cy.get('p').should(
      'contain',
      'This site was created to demonstrate my mastery of Redwood: Look on my works, ye mighty, and despair!'
    )
  })

  it('4. Getting Dynamic', () => {
    // https://redwoodjs.com/tutorial/getting-dynamic
    cy.writeFile(path.join(BASE_DIR, 'api/db/schema.prisma'), Step4_1_DbSchema)
    cy.exec(`rm ${BASE_DIR}/api/db/dev.db`, { failOnNonZeroExit: false })
    // need to also handle case where Prisma Client be out of sync
    cy.exec(
      `cd ${BASE_DIR}; yarn rimraf ./api/db/migrations && yarn rw prisma migrate reset --skip-seed --force`
    )
    cy.exec(`cd ${BASE_DIR}; yarn rw prisma migrate dev`)

    cy.exec(`cd ${BASE_DIR}; yarn rw g scaffold post --force`)

    cy.visit('http://localhost:8910/posts')

    cy.get('h1').should('contain', 'Posts')
    cy.get('a.rw-button.rw-button-green').should(
      'have.css',
      'background-color',
      'rgb(72, 187, 120)'
    )
    cy.contains(' New Post').click()
    cy.get('h2').should('contain', 'New Post')

    // SAVE
    cy.get('input#title').type('First post')
    cy.get('input#body').type('Hello world!')
    //check scaffold css
    cy.get('button.rw-button.rw-button-blue').should(
      'have.css',
      'background-color',
      'rgb(49, 130, 206)'
    )
    cy.get('button').contains('Save').click()

    cy.contains('Post created')

    cy.contains('Loading...').should('not.exist')
    //checks Toast messages
    cy.get('div[role="status"]').contains('Post created')

    // EDIT
    cy.contains('Edit').click()
    cy.contains('Loading...').should('not.exist')
    cy.get('h2').contains('Edit Post 1')
    cy.get('input#body').clear().type('No, Margle the World!')
    cy.get('button').contains('Save').click()
    cy.get('td').contains('No, Margle the World!')
    cy.get('div[role="status"]').contains('Post updated')

    cy.contains('Post updated')

    // DELETE
    cy.contains('Delete').click()

    // No more posts, so it should be in the empty state.
    cy.contains('Post deleted')
    cy.get('div[role="status"]').contains('Post deleted')

    cy.contains('Create one?').click()
    cy.get('input#title').type('Second post')
    cy.get('input#body').type('Hello world!')
    cy.get('button').contains('Save').click()
  })

  it('5. Cells', () => {
    cy.exec(`cd ${BASE_DIR}; yarn rw g cell BlogPosts --force`)
    cy.writeFile(
      path.join(BASE_DIR, 'web/src/components/BlogPostsCell/BlogPostsCell.js'),
      Step5_1_ComponentsCellBlogPost
    )
    cy.writeFile(
      path.join(
        BASE_DIR,
        'web/src/components/BlogPostsCell/BlogPostsCell.test.js'
      ),
      Step5_2_ComponentsCellBlogPostTest
    )
    cy.writeFile(
      path.join(BASE_DIR, 'web/src/pages/HomePage/HomePage.js'),
      Step5_3_PagesHome
    )
    cy.visit('http://localhost:8910/posts/2') // adding step for pause
    cy.visit('http://localhost:8910/')

    cy.get('main').should(
      'contain',
      // [{"title":"Second post","body":"Hello world!","__typename":"Post"}]
      '"body":"Hello world!"'
    )
  })

  it('6. Routing Params', () => {
    // https://redwoodjs.com/tutorial/routing-params
    cy.exec(`cd ${BASE_DIR}; yarn rw g page BlogPost --force`)
    cy.exec(`cd ${BASE_DIR}; yarn rw g cell BlogPost --force`)
    cy.exec(`cd ${BASE_DIR}; yarn rw g component BlogPost --force`)

    cy.writeFile(path.join(BASE_DIR, 'web/src/Routes.js'), Step6_1_Routes)
    cy.writeFile(
      path.join(BASE_DIR, 'web/src/pages/BlogPostPage/BlogPostPage.js'),
      Step6_2_BlogPostPage
    )
    cy.writeFile(
      path.join(BASE_DIR, 'web/src/components/BlogPostCell/BlogPostCell.js'),
      Step6_3_BlogPostCell
    )
    cy.writeFile(
      path.join(
        BASE_DIR,
        'web/src/components/BlogPostCell/BlogPostCell.test.js'
      ),
      Step6_3_BlogPostCellTest
    )
    cy.writeFile(
      path.join(BASE_DIR, 'web/src/components/BlogPost/BlogPost.js'),
      Step6_4_BlogPost
    )
    cy.writeFile(
      path.join(BASE_DIR, 'web/src/components/BlogPost/BlogPost.test.js'),
      Step6_4_BlogPostTest
    )
    cy.writeFile(
      path.join(BASE_DIR, 'web/src/components/BlogPostsCell/BlogPostsCell.js'),
      Step6_5_BlogPostsCell
    )
    cy.writeFile(
      path.join(
        BASE_DIR,
        'web/src/components/BlogPostsCell/BlogPostsCell.mock.js'
      ),
      Step6_5_BlogPostsCellMock
    )

    // New entry
    cy.visit('http://localhost:8910/posts')
    cy.contains(' New Post').click()
    cy.get('input#title').type('Third post')
    cy.get('input#body').type('foo bar')
    cy.get('button').contains('Save').click()

    cy.visit('http://localhost:8910/')

    // Detail Page
    cy.contains('Second post').click()
    cy.get('main').should('contain', 'Hello world!')

    cy.visit('http://localhost:8910/')

    cy.contains('Third post').click()
    cy.get('main').should('contain', 'foo bar')
  })

  it("7. Everyone's Favorite Thing to Build: Forms", () => {
    // https://redwoodjs.com/tutorial/everyone-s-favorite-thing-to-build-forms
    cy.exec(`cd ${BASE_DIR}; yarn rw g page contact --force`)

    cy.writeFile(
      path.join(BASE_DIR, 'web/src/layouts/BlogLayout/BlogLayout.js'),
      Step7_1_BlogLayout
    )
    cy.writeFile(
      path.join(BASE_DIR, 'web/src/pages/ContactPage/ContactPage.js'),
      Step7_2_ContactPage
    )
    cy.writeFile(path.join(BASE_DIR, 'web/src/index.css'), Step7_3_Css)
    cy.writeFile(path.join(BASE_DIR, 'web/src/Routes.js'), Step7_4_Routes)

    cy.contains('Contact').click()
    cy.contains('Save').click()
    cy.get('main').should('contain', 'name is required')
    cy.get('main').should('contain', 'email is required')
    cy.get('main').should('contain', 'message is required')

    cy.get('input#email').type('foo bar')
    cy.contains('Save').click()
    cy.get('main').should('contain', 'Please enter a valid email address')

    cy.get('input#name').type('test name')
    cy.get('input#email').type('foo@bar.com')
    cy.get('textarea#message').type('test message')
    cy.get('#tutorial-form').submit()
  })

  it('8. Saving Data', () => {
    // navigate back out
    cy.visit('http://localhost:8910/')

    // Create a CRUD contacts service
    cy.exec(`cd ${BASE_DIR}; yarn rw g sdl contact --force --crud`)

    cy.writeFile(
      path.join(BASE_DIR, 'web/src/pages/ContactPage/ContactPage.js'),
      Step8_1_ContactPageWithoutJsEmailValidation
    )

    cy.writeFile(
      path.join(BASE_DIR, 'api/src/services/contacts/contacts.js'),
      Step8_2_CreateContactServiceValidation
    )

    // then get to new contact with api side validation
    cy.contains('Contact').click()

    cy.get('input#name').clear().type('test name')
    cy.get('input#email').clear().type('foo bar com')
    cy.get('textarea#message').clear().type('test message')
    cy.contains('Save').click()

    cy.get('main').should('contain', "Can't create new contact")
    cy.get('main').should('contain', 'is not formatted like an email address')

    // then test saving with a valid email
    cy.get('input#email').clear().type('test@example.com')
    cy.contains('Save').click()

    cy.get('main').should('contain', 'Thank you for your submission')
  })

  it('9. Auth - Render Cell Failure Message', () => {
    // enable auth
    cy.writeFile(
      path.join(BASE_DIR, 'api/src/lib/auth.js'),
      Step9_1_RequireAuth
    )

    cy.writeFile(
      path.join(BASE_DIR, 'api/src/services/posts/posts.js'),
      Step9_2_PostsRequireAuth
    )

    cy.visit('http://localhost:8910/posts')

    cy.get('main').should('not.contain', 'Second post')

    cy.get('main > div:nth-child(1)').should('contain', 'Error')
    cy.get('main > div:nth-child(1)').should('contain', "can't do that")

    // disable auth
    cy.writeFile(
      path.join(BASE_DIR, 'api/src/lib/auth.js'),
      Step9_3_DisableAuth
    )
  })
})
