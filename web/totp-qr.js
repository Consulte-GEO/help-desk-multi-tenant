import qrcodegen from './vendor/qrcodegen.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Construct only our validated TOTP provisioning data, never the provider's URI or SVG. */
export function totpProvisioningUri(secret,factorId){
 if(typeof secret!=='string'||!/^[A-Z2-7]{16,128}$/.test(secret)||typeof factorId!=='string'||!UUID.test(factorId))throw Error('Cadastro TOTP incompatível.');
 return 'otpauth://totp/'+encodeURIComponent('Consulte Help Desk:'+factorId.toLowerCase())+'?'+new URLSearchParams({secret,issuer:'Consulte Help Desk',algorithm:'SHA1',digits:'6',period:'30'});
}
/** Raster only. No serialized URI, data URL, external image, DOM markup or retained seed. */
export function drawTotpQr(canvas,secret,factorId){
 const uri=totpProvisioningUri(secret,factorId),qr=qrcodegen.QrCode.encodeText(uri,qrcodegen.QrCode.Ecc.MEDIUM);
 const context=canvas.getContext('2d');if(!context)throw Error('QR indisponível neste navegador.');
 const scale=4,border=4;canvas.width=canvas.height=(qr.size+border*2)*scale;
 context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#000';
 for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))context.fillRect((x+border)*scale,(y+border)*scale,scale,scale);
 canvas.hidden=false;
}
