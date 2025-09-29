import { Hono } from 'hono'
import health from './health'

const api = new Hono()

api.route('/health', health)

export default api


