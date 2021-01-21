import { DefaultHost } from '../../hosts'
import { RWProject } from '../RWProject'

describe.skip('stuff', () => {
  it('graphql', async () => {
    //const projectRoot = getFixtureDir('example-todo-main')
    const projectRoot = '/Users/aldo/com.github/redwoodjs/example-blog'
    const project = new RWProject({ projectRoot, host: new DefaultHost() })
    project.graphqlHelper.mergedSchema //?
  })
})
