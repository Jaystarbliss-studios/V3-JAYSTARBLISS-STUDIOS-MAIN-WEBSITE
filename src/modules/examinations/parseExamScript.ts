import type { ExamQuestion, QuestionType } from "./types";
const makeId=()=>typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():"question-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
/** Deterministic parser for numbered scripts, A-D options, and inline or multiline answer keys. Always review before publishing. */
export function parseExamScript(source:string,defaultPoints=1):ExamQuestion[]{
 const lines=source.replace(/\r\n?/g,"\n").split("\n");const blocks:string[]=[];let current="";let answerKeyText="";let inAnswerKey=false;
 for(const line of lines){
  const keyHeader=line.match(/^\s*(answer\s*key|answers)\s*(?::|-)?\s*(.*)$/i);
  if(keyHeader){if(current.trim())blocks.push(current.trim());current="";inAnswerKey=true;if(keyHeader[2])answerKeyText+=" "+keyHeader[2];continue;}
  if(inAnswerKey){answerKeyText+=" "+line;continue;}
  if(/^\s*\d+[.)]\s+/.test(line)){if(current.trim())blocks.push(current.trim());current=line.replace(/^\s*\d+[.)]\s+/,"");}
  else if(current)current+="\n"+line;
 }
 if(current.trim())blocks.push(current.trim());
 const parsed=blocks.map((block):ExamQuestion=>{const rows=block.split("\n").map(row=>row.trim()).filter(Boolean);const prompt=rows.shift()||"Untitled question";const optionRows=rows.map(row=>row.match(/^\(?([A-D])\)?[.)]\s*(.+)$/)).filter(Boolean) as RegExpMatchArray[];let type:QuestionType="short_answer";let options:ExamQuestion["options"]=[];
 if(optionRows.length>=2){type="single_choice";options=optionRows.map(m=>({id:m[1].toUpperCase(),text:m[2].trim()}));}else if(/^\s*(true|false)\s*$/i.test(prompt)){type="true_false";options=[{id:"TRUE",text:"True"},{id:"FALSE",text:"False"}];}
 return {id:makeId(),type,prompt,options,points:Math.max(0.25,defaultPoints),required:true};});
 for(const match of answerKeyText.matchAll(/(\d+)\s*[-.):]\s*(A|B|C|D|TRUE|FALSE)\b/gi)){const index=Number(match[1])-1;const answer=match[2].toUpperCase();if(parsed[index]&&parsed[index].options.some(o=>o.id===answer))parsed[index].correctOptionIds=[answer];}
 return parsed;
}
