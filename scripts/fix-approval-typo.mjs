import fs from 'node:fs';
const path='src/components/admin/StudentEnrollmentApprovalModal.tsx';
const source=fs.readFileSync(path,'utf8');
const needle="const [days,setDays]=useState<string[]>(['Saturday']),[daySchedules,setDaySchedules]=useState<Record<string,{startTime:string;endTime:string}>>({Saturday:{startTime:'10:00',endTime:'12:00'}}),[durationWeeks,setDurationWeeks]=useState(8),[deliveryMode,setDeliveryMode]=useState<'online'|'physical'|'hybrid'>('online'),[meetingLink,setMeetingLink]=useState(''),[location,setLocation]='';";
const replacement="const [days,setDays]=useState<string[]>(['Saturday']),[daySchedules,setDaySchedules]=useState<Record<string,{startTime:string;endTime:string}>>({Saturday:{startTime:'10:00',endTime:'12:00'}}),[durationWeeks,setDurationWeeks]=useState(8),[deliveryMode,setDeliveryMode]=useState<'online'|'physical'|'hybrid'>('online'),[meetingLink,setMeetingLink]=useState(''),[location,setLocation]=useState('');";
if(!source.includes(needle)) throw new Error('Approval modal typo pattern not found');
fs.writeFileSync(path,source.replace(needle,replacement),'utf8');
