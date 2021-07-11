global.__dirname = __dirname
import path from 'path'

// Load mocks
import 'src/lib/test'

import { getDefaultArgs } from 'src/lib'

import { yargsDefaults as defaults } from '../../../generate'
import * as scaffold from '../scaffold'

describe('in javascript (default) mode', () => {
  let files

  beforeAll(async () => {
    files = await scaffold.files({
      ...getDefaultArgs(defaults),
      model: 'Post',
      tests: true,
      nestScaffoldByModel: true,
    })
  })

  test('returns exactly 17 files', () => {
    expect(Object.keys(files).length).toEqual(17)
  })
  // SDL

  test('creates an sdl', () => {
    expect(files).toHaveProperty([
      path.normalize('/path/to/project/api/src/graphql/posts.sdl.js'),
    ])
  })

  // Service

  test('creates a service', () => {
    expect(files).toHaveProperty([
      path.normalize('/path/to/project/api/src/services/posts/posts.js'),
    ])
  })

  test('creates a service test', () => {
    expect(files).toHaveProperty([
      path.normalize('/path/to/project/api/src/services/posts/posts.test.js'),
    ])
  })

  // styles

  test('creates a stylesheet', () => {
    expect(
      files[path.normalize('/path/to/project/web/src/scaffold.css')]
    ).toMatchSnapshot()
  })

  // Layout

  test('creates a layout', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/layouts/PostsLayout/PostsLayout.js'
        )
      ]
    ).toMatchSnapshot()
  })

  // Pages

  test('creates a edit page', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/pages/Post/EditPostPage/EditPostPage.js'
        )
      ]
    ).toMatchSnapshot()
  })

  test('the edit page correctly imports the edit cell', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/pages/Post/EditPostPage/EditPostPage.js'
        )
      ]
    ).toMatch(`import EditPostCell from 'src/components/Post/EditPostCell'`)
  })

  test('creates a index page', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/pages/Post/PostsPage/PostsPage.js'
        )
      ]
    ).toMatchSnapshot()
  })

  test('the index page correctly imports the index cell', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/pages/Post/PostsPage/PostsPage.js'
        )
      ]
    ).toMatch(`import PostsCell from 'src/components/Post/PostsCell'`)
  })

  test('creates a new page', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/pages/Post/NewPostPage/NewPostPage.js'
        )
      ]
    ).toMatchSnapshot()
  })

  test('the new page correctly imports the new component', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/pages/Post/NewPostPage/NewPostPage.js'
        )
      ]
    ).toMatch(`import NewPost from 'src/components/Post/NewPost'`)
  })

  test('creates a show page', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/pages/Post/PostPage/PostPage.js'
        )
      ]
    ).toMatchSnapshot()
  })

  test('the show page correctly imports the show cell', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/pages/Post/PostPage/PostPage.js'
        )
      ]
    ).toMatch(`import PostCell from 'src/components/Post/PostCell'`)
  })

  // Cells

  test('creates an edit cell', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/components/Post/PostEditCell/PostEditCell.js'
        )
      ]
    ).toMatchSnapshot()
  })

  test('the edit cell correctly imports the form', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/components/Post/EditPostCell/EditPostCell.js'
        )
      ]
    ).toMatch(`import PostForm from 'src/components/Post/PostForm'`)
  })

  test('creates an index cell', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/components/Post/PostsCell/PostsCell.js'
        )
      ]
    ).toMatchSnapshot()
  })

  test('the index cell correctly imports the index component', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/components/Post/PostsCell/PostsCell.js'
        )
      ]
    ).toMatch(`import Posts from 'src/components/Post/Posts'`)
  })

  test('creates a show cell', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/components/Post/PostCell/PostCell.js'
        )
      ]
    ).toMatchSnapshot()
  })

  test('the show cell correctly imports the show component', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/components/Post/PostCell/PostCell.js'
        )
      ]
    ).toMatch(`import Post from 'src/components/Post/Post'`)
  })

  // Components

  test('creates a form component', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/components/Post/PostForm/PostForm.js'
        )
      ]
    ).toMatchSnapshot()
  })

  test('creates an index component', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/components/Post/Posts/Posts.js'
        )
      ]
    ).toMatchSnapshot()
  })

  test('the index component correctly imports the QUERY', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/components/Post/Posts/Posts.js'
        )
      ]
    ).toMatch(`import { QUERY } from 'src/components/Post/PostsCell'`)
  })

  test('creates a new component', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/components/Post/NewPost/NewPost.js'
        )
      ]
    ).toMatchSnapshot()
  })

  test('the new component correctly imports the form', async () => {
    expect(
      files[
        path.normalize(
          '/path/to/project/web/src/components/Post/NewPost/NewPost.js'
        )
      ]
    ).toMatch(`import PostForm from 'src/components/Post/PostForm'`)
  })

  test('creates a show component', async () => {
    expect(
      files[
        path.normalize('/path/to/project/web/src/components/Post/Post/Post.js')
      ]
    ).toMatchSnapshot()
  })

  test('error when no editable fields are in model', async () => {
    await expect(
      scaffold.files({
        ...getDefaultArgs(defaults),
        model: 'NoEditableField',
        tests: true,
        nestScaffoldByModel: true,
      })
    ).rejects.toThrow(
      'There are no editable fields in the NoEditableField model'
    )
  })

  // Routes

  test('creates a single-word name routes', async () => {
    expect(
      await scaffold.routes({ model: 'Post', nestScaffoldByModel: true })
    ).toEqual([
      '<Route path="/posts/new" page={PostNewPostPage} name="newPost" />',
      '<Route path="/posts/{id:Int}/edit" page={PostEditPostPage} name="editPost" />',
      '<Route path="/posts/{id:Int}" page={PostPostPage} name="post" />',
      '<Route path="/posts" page={PostPostsPage} name="posts" />',
    ])
  })

  test('creates a multi-word name routes', async () => {
    expect(
      await scaffold.routes({ model: 'UserProfile', nestScaffoldByModel: true })
    ).toEqual([
      '<Route path="/user-profiles/new" page={UserProfileNewUserProfilePage} name="newUserProfile" />',
      '<Route path="/user-profiles/{id:Int}/edit" page={UserProfileEditUserProfilePage} name="editUserProfile" />',
      '<Route path="/user-profiles/{id:Int}" page={UserProfileUserProfilePage} name="userProfile" />',
      '<Route path="/user-profiles" page={UserProfileUserProfilesPage} name="userProfiles" />',
    ])
  })

  // GraphQL queries

  test('the GraphQL in the index query does not contain object types', async () => {
    const userProfileFiles = await scaffold.files({
      model: 'UserProfile',
      tests: false,
      nestScaffoldByModel: true,
    })
    const cell =
      userProfileFiles[
        path.normalize(
          '/path/to/project/web/src/components/UserProfile/UserProfilesCell/UserProfilesCell.js'
        )
      ]
    const query = cell.match(/(userProfiles.*?\})/s)[1]

    expect(query).not.toMatch(/^\s+user$/m)
  })

  test('the GraphQL in the show query does not contain object types', async () => {
    const userProfileFiles = await scaffold.files({
      model: 'UserProfile',
      tests: false,
      nestScaffoldByModel: true,
    })
    const cell =
      userProfileFiles[
        path.normalize(
          '/path/to/project/web/src/components/UserProfile/UserProfileCell/UserProfileCell.js'
        )
      ]
    const query = cell.match(/(userProfile.*?\})/s)[1]

    expect(query).not.toMatch(/^\s+user$/m)
  })

  test('the GraphQL in the edit query does not contain object types', async () => {
    const userProfileFiles = await scaffold.files({
      model: 'UserProfile',
      tests: false,
      nestScaffoldByModel: true,
    })
    const cell =
      userProfileFiles[
        path.normalize(
          '/path/to/project/web/src/components/UserProfile/EditUserProfileCell/EditUserProfileCell.js'
        )
      ]
    const query = cell.match(/(userProfile.*?\})/s)[1]

    expect(query).not.toMatch(/^\s+user$/m)
  })

  // Foreign key casting

  test('creates a new component with int foreign keys converted in onSave', async () => {
    const foreignKeyFiles = await scaffold.files({
      model: 'UserProfile',
      tests: false,
      nestScaffoldByModel: true,
    })

    expect(
      foreignKeyFiles[
        path.normalize(
          '/path/to/project/web/src/components/UserProfile/NewUserProfile/NewUserProfile.js'
        )
      ]
    ).toMatchSnapshot()
  })

  test('creates an edit component with int foreign keys converted in onSave', async () => {
    const foreignKeyFiles = await scaffold.files({
      model: 'UserProfile',
      tests: false,
      nestScaffoldByModel: true,
    })

    expect(
      foreignKeyFiles[
        path.normalize(
          '/path/to/project/web/src/components/UserProfile/EditUserProfileCell/EditUserProfileCell.js'
        )
      ]
    ).toMatchSnapshot()
  })
})

describe('in typescript mode', () => {
  let tsFiles

  beforeAll(async () => {
    tsFiles = await scaffold.files({
      ...getDefaultArgs(defaults),
      model: 'Post',
      typescript: true,
      tests: true,
      nestScaffoldByModel: true,
    })
  })

  test('returns exactly 17 files', () => {
    expect(Object.keys(tsFiles).length).toEqual(17)
  })

  // SDL

  test('creates an sdl', () => {
    expect(tsFiles).toHaveProperty([
      path.normalize('/path/to/project/api/src/graphql/posts.sdl.ts'),
    ])
  })

  // Service

  test('creates a service', () => {
    expect(tsFiles).toHaveProperty([
      path.normalize('/path/to/project/api/src/services/posts/posts.ts'),
    ])
  })

  test('creates a service test', () => {
    expect(tsFiles).toHaveProperty([
      path.normalize('/path/to/project/api/src/services/posts/posts.test.ts'),
    ])
  })

  // styles

  test('creates a stylesheet', () => {
    expect(
      tsFiles[path.normalize('/path/to/project/web/src/scaffold.css')]
    ).toMatchSnapshot()
  })

  // Layout

  test('creates a layout', async () => {
    expect(
      tsFiles[
        path.normalize(
          '/path/to/project/web/src/layouts/PostsLayout/PostsLayout.tsx'
        )
      ]
    ).toMatchSnapshot()
  })

  // Pages

  test('creates a edit page', async () => {
    expect(
      tsFiles[
        path.normalize(
          '/path/to/project/web/src/pages/Post/EditPostPage/EditPostPage.tsx'
        )
      ]
    ).toMatchSnapshot()
  })

  test('creates a index page', async () => {
    expect(
      tsFiles[
        path.normalize(
          '/path/to/project/web/src/pages/Post/PostsPage/PostsPage.tsx'
        )
      ]
    ).toMatchSnapshot()
  })

  test('creates a new page', async () => {
    expect(
      tsFiles[
        path.normalize(
          '/path/to/project/web/src/pages/Post/NewPostPage/NewPostPage.tsx'
        )
      ]
    ).toMatchSnapshot()
  })

  test('creates a show page', async () => {
    expect(
      tsFiles[
        path.normalize(
          '/path/to/project/web/src/pages/Post/PostPage/PostPage.tsx'
        )
      ]
    ).toMatchSnapshot()
  })

  // Cells

  test('creates an edit cell', async () => {
    expect(
      tsFiles[
        path.normalize(
          '/path/to/project/web/src/components/Post/EditPostCell/EditPostCell.tsx'
        )
      ]
    ).toMatchSnapshot()
  })

  test('creates an index cell', async () => {
    expect(
      tsFiles[
        path.normalize(
          '/path/to/project/web/src/components/Post/PostsCell/PostsCell.tsx'
        )
      ]
    ).toMatchSnapshot()
  })

  test('creates a show cell', async () => {
    expect(
      tsFiles[
        path.normalize(
          '/path/to/project/web/src/components/Post/PostCell/PostCell.tsx'
        )
      ]
    ).toMatchSnapshot()
  })

  // Components

  test('creates a form component', async () => {
    expect(
      tsFiles[
        path.normalize(
          '/path/to/project/web/src/components/Post/PostForm/PostForm.tsx'
        )
      ]
    ).toMatchSnapshot()
  })

  test('creates an index component', async () => {
    expect(
      tsFiles[
        path.normalize(
          '/path/to/project/web/src/components/Post/Posts/Posts.tsx'
        )
      ]
    ).toMatchSnapshot()
  })

  test('creates a new component', async () => {
    expect(
      tsFiles[
        path.normalize(
          '/path/to/project/web/src/components/Post/NewPost/NewPost.tsx'
        )
      ]
    ).toMatchSnapshot()
  })

  test('creates a show component', async () => {
    expect(
      tsFiles[
        path.normalize('/path/to/project/web/src/components/Post/Post/Post.tsx')
      ]
    ).toMatchSnapshot()
  })

  // Routes

  test('creates a single-word name routes', async () => {
    expect(
      await scaffold.routes({ model: 'Post', nestScaffoldByModel: true })
    ).toEqual([
      '<Route path="/posts/new" page={PostNewPostPage} name="newPost" />',
      '<Route path="/posts/{id:Int}/edit" page={PostEditPostPage} name="editPost" />',
      '<Route path="/posts/{id:Int}" page={PostPostPage} name="post" />',
      '<Route path="/posts" page={PostPostsPage} name="posts" />',
    ])
  })

  test('creates a multi-word name routes', async () => {
    expect(
      await scaffold.routes({ model: 'UserProfile', nestScaffoldByModel: true })
    ).toEqual([
      '<Route path="/user-profiles/new" page={UserProfileNewUserProfilePage} name="newUserProfile" />',
      '<Route path="/user-profiles/{id:Int}/edit" page={UserProfileEditUserProfilePage} name="editUserProfile" />',
      '<Route path="/user-profiles/{id:Int}" page={UserProfileUserProfilePage} name="userProfile" />',
      '<Route path="/user-profiles" page={UserProfileUserProfilesPage} name="userProfiles" />',
    ])
  })

  // GraphQL queries

  test('the GraphQL in the index query does not contain object types', async () => {
    const userProfileFiles = await scaffold.files({
      model: 'UserProfile',
      tests: false,
      nestScaffoldByModel: true,
    })
    const cell =
      userProfileFiles[
        path.normalize(
          '/path/to/project/web/src/components/UserProfile/UserProfilesCell/UserProfilesCell.js'
        )
      ]
    const query = cell.match(/(userProfiles.*?\})/s)[1]

    expect(query).not.toMatch(/^\s+user$/m)
  })

  test('the GraphQL in the show query does not contain object types', async () => {
    const userProfileFiles = await scaffold.files({
      model: 'UserProfile',
      tests: false,
      nestScaffoldByModel: true,
    })
    const cell =
      userProfileFiles[
        path.normalize(
          '/path/to/project/web/src/components/UserProfile/UserProfileCell/UserProfileCell.js'
        )
      ]
    const query = cell.match(/(userProfile.*?\})/s)[1]

    expect(query).not.toMatch(/^\s+user$/m)
  })

  test('the GraphQL in the edit query does not contain object types', async () => {
    const userProfileFiles = await scaffold.files({
      model: 'UserProfile',
      typescript: true,
      tests: false,
      nestScaffoldByModel: true,
    })
    const cell =
      userProfileFiles[
        path.normalize(
          '/path/to/project/web/src/components/UserProfile/EditUserProfileCell/EditUserProfileCell.tsx'
        )
      ]
    const query = cell.match(/(userProfile.*?\})/s)[1]

    expect(query).not.toMatch(/^\s+user$/m)
  })

  // Foreign key casting

  test('creates a new component with int foreign keys converted in onSave', async () => {
    const foreignKeyFiles = await scaffold.files({
      model: 'UserProfile',
      typescript: true,
      tests: false,
      nestScaffoldByModel: true,
    })

    expect(
      foreignKeyFiles[
        path.normalize(
          '/path/to/project/web/src/components/UserProfile/NewUserProfile/NewUserProfile.tsx'
        )
      ]
    ).toMatchSnapshot()
  })

  test('creates an edit component with int foreign keys converted in onSave', async () => {
    const foreignKeyFiles = await scaffold.files({
      model: 'UserProfile',
      typescript: true,
      tests: false,
      nestScaffoldByModel: true,
    })

    expect(
      foreignKeyFiles[
        path.normalize(
          '/path/to/project/web/src/components/UserProfile/EditUserProfileCell/EditUserProfileCell.tsx'
        )
      ]
    ).toMatchSnapshot()
  })
})
