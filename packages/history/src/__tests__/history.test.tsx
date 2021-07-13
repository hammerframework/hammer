import { navigate } from '../history'

describe('navigate', () => {
  describe('does not increase history length', () => {
    it('handles direct matches for pathname, search, and hash', () => {
      expect(global.history.length).toEqual(1)
      navigate('/test-1?search=testing#test')
      expect(global.history.length).toEqual(2)
      navigate('/test-1?search=testing#test')
      expect(global.history.length).toEqual(2)
    })
  })

  describe('increasing history length', () => {
    it('handles pathname', () => {
      expect(global.history.length).toEqual(2)
      navigate('/test-2')
      expect(global.history.length).toEqual(3)
      navigate('/test-3')
      expect(global.history.length).toEqual(4)
    })

    it('handles search', () => {
      expect(global.history.length).toEqual(4)
      navigate('/test-3')
      expect(global.history.length).toEqual(4)
      navigate('/test-3?search=testing')
      expect(global.history.length).toEqual(5)
      navigate('/test-3?search=testing')
      expect(global.history.length).toEqual(5)
    })

    it('handles hash', () => {
      expect(global.history.length).toEqual(5)
      navigate('/test-3')
      expect(global.history.length).toEqual(6)
      navigate('/test-3#testing')
      expect(global.history.length).toEqual(7)
      navigate('/test-3#testing')
      expect(global.history.length).toEqual(7)
    })
  })
})
