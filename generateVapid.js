const fs = require('fs');
const wp = require('web-push');

const envPath = './.env';
const keys = wp.generateVAPIDKeys();
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

if (!env.includes('VAPID_PUBLIC_KEY')) {
  fs.appendFileSync(envPath, `\n# Web Push VAPID Keys\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=mailto:admin@fonest.com\n`);
  console.log('Keys appended to .env. PublicKey:', keys.publicKey);
} else {
  console.log('Keys already in .env');
  const lines = env.split('\n');
  const pub = lines.find(l => l.startsWith('VAPID_PUBLIC_KEY='));
  if (pub) console.log('PublicKey:', pub.split('=')[1]);
}
