import { RvmBoreConverter } from '../viewer/rvm-pcf-extract/RvmBoreConverter.js';
const b=new RvmBoreConverter();
const samples=['/BTRM-1000-10"-P1710011-66620M0-01/B1','/BTRM-1000-14"-P1710001-66620M0-01/B4','250mm','200mm','DTXR GUIDE SUPPORT','DTXR ELBOW 90 DEG LR BW Sch 80S'];
for(const s of samples) console.log(s, '=> linekey', b.parseLineKeyBoreMm(s), 'convert', b.convertBore(s));
