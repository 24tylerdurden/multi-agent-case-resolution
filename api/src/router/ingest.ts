import {Router} from 'express' 

const router = Router()


router.post('/transaction', (req, res) => {
    res.json({'accepted': true, count :0, })
})

export default router