// Giả lập IPN VNPAY sandbox: node vnp_sign.js <txnRef> <amountVND> [responseCode]
const crypto = require('crypto')
const secret = 'YFFJDENNWNIZZYNWLPCRWZFNIKCGEYDQ' // vnpay.hash-secret (sandbox) trong application.yaml
const [ref, amount, code = '00'] = process.argv.slice(2)
const p = {
  vnp_TxnRef: ref,
  vnp_Amount: String(Math.round(Number(amount) * 100)),
  vnp_ResponseCode: code,
  vnp_TransactionStatus: code === '00' ? '00' : '02',
  vnp_TmnCode: '83NI8FOK',
}
const enc = (v) => encodeURIComponent(v).replace(/%20/g, '+')
const q = Object.keys(p).sort().map((k) => enc(k) + '=' + enc(p[k])).join('&')
process.stdout.write(q + '&vnp_SecureHash=' + crypto.createHmac('sha512', secret).update(q).digest('hex'))
