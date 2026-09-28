import fs from 'node:fs';
const path='src/components/admin/StudentEnrollmentApprovalModal.tsx';
let source=fs.readFileSync(path,'utf8');
const replacements=[
 ["const [days,setDays]=useState<string[]>(['Saturday']),[daySchedules,setDaySchedules]=useState<Record<string,{startTime:string;endTime:string}>>({Saturday:{startTime:'10:00',endTime:'12:00'}}),[durationWeeks,setDurationWeeks]=useState(8),[deliveryMode,setDeliveryMode]=useState<'online'|'physical'|'hybrid'>('online'),[meetingLink,setMeetingLink]=useState(''),[location,setLocation]='';","const [days,setDays]=useState<string[]>(['Saturday']),[daySchedules,setDaySchedules]=useState<Record<string,{startTime:string;endTime:string}>>({Saturday:{startTime:'10:00',endTime:'12:00'}}),[durationWeeks,setDurationWeeks]=useState(8),[deliveryMode,setDeliveryMode]=useState<'online'|'physical'|'hybrid'>('online'),[meetingLink,setMeetingLink]=useState(''),[location,setLocation]=useState('');"],
 ["const updateDay=(day:string,field:'startTime'|'endTime',value:string)=>setDaySchedules(v=>({...v,[day]:{...(v[day]||{startTime:'10:00',endTime:'12:00'}),[field]:value}});","const updateDay=(day:string,field:'startTime'|'endTime',value:string)=>setDaySchedules(v=>({...v,[day]:{...(v[day]||{startTime:'10:00',endTime:'12:00'}),[field]:value}}));"]
];
for(const [needle,replacement] of replacements){if(source.includes(needle))source=source.replace(needle,replacement)}
fs.writeFileSync(path,source,'utf8');
