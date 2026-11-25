import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeSearch,prepareSearchRecords,searchRecords,safeSearchHref} from '../assets/search-core.js';
import {parseDataLiteral,extractArray,subjectLabels} from '../scripts/build-search-index.mjs';
import {cairoWeek,cairoCalendarDay,studentHomeSummary,approvedExam} from '../assets/student-home-progress-core.js';
const sample=prepareSearchRecords([
  {id:'one',title:'الفيزياء — الحركة',type:'book',subject:'الفيزياء',subjects:['الفيزياء'],grade:'الثاني الثانوي',grades:['الثاني الثانوي'],description:'كتاب وتمارين',href:'store/index.html?product=one#catalog'},
  {id:'two',title:'أحكام التَّجويد',type:'course',subject:'القرآن الكريم',subjects:['القرآن الكريم'],grade:'',grades:[],description:'',href:'sections/Quran/quran.html'},
  {id:'three',title:'English — Unit 1',type:'exam',subject:'اللغة الإنجليزية',subjects:['اللغة الإنجليزية'],grade:'الثاني الثانوي',grades:['الثاني الثانوي'],description:'',href:'sections/tests/unit-one-exam.html?id=english'},
]);
test('Arabic normalization handles diacritics, hamza, tatweel, Arabic digits, and English aliases',()=>{
  assert.equal(normalizeSearch('أَحْكَام التَّجْوِيد'),normalizeSearch('احكام التجويد'));
  assert.equal(normalizeSearch('الـقُرْآن'),normalizeSearch('القران'));
  assert.equal(searchRecords(sample,{query:'انجليزي ٢ث'})[0]?.id,'three');
});
test('Multiple words all match across title, subject and grade, independent of order',()=>{
  assert.equal(searchRecords(sample,{query:'الثاني فيزياء'})[0]?.id,'one');
  assert.equal(searchRecords(sample,{query:'فيزياء ابتدائي'}).length,0);
  assert.equal(searchRecords(sample,{query:'التجويد احكام'})[0]?.id,'two');
});
test('Filters compose with text and do not fabricate an empty category',()=>{
  assert.equal(searchRecords(sample,{query:'الثاني',type:'exam',subject:'اللغة الإنجليزية',grade:'الثاني الثانوي'})[0]?.id,'three');
  assert.equal(searchRecords(sample,{type:'summary'}).length,0);
  assert.equal(searchRecords(sample,{query:'فيزياء',grade:'الأول الثانوي'}).length,0);
});
test('Search result URLs stay local HTML routes',()=>{
  for(const value of ['javascript:alert(1)','https://example.org/a.html','//example.org/a.html','../admin.html','books/private.pdf','data:text/html,x'])assert.equal(safeSearchHref(value),'');
  assert.equal(safeSearchHref('sections/book-access.html?legacy='+'a'.repeat(64)),'sections/book-access.html?legacy='+'a'.repeat(64));
});
test('The build parser accepts only data and rejects executable expressions',()=>{
  assert.deepEqual([...extractArray("export const items = [{id:'a', enabled:true, grades:[1,2], value:null},];",'items')].map(x=>x.id),['a']);
  assert.throws(()=>parseDataLiteral('[process.exit()]'));
  assert.throws(()=>parseDataLiteral('[{get secret(){return 1}}]'));
  assert.throws(()=>parseDataLiteral('[{__proto__:1}]'));
});
test('Cairo week rolls over on Saturday in winter and summer time',()=>{
  assert.equal(cairoCalendarDay(new Date('2026-11-27T22:30:00Z')),'2026-11-28');
  assert.deepEqual(cairoWeek(new Date('2026-11-27T22:30:00Z')),{start:'2026-11-28',end:'2026-12-04',today:'2026-11-28'});
  assert.equal(cairoCalendarDay(new Date('2026-07-03T21:30:00Z')),'2026-07-04');
});
test('Weekly attendance is UID-scoped, counts only recorded statuses and excludes future days',()=>{
  const attendance=[
    {id:'1',studentUid:'u1',date:'2026-11-21',status:'حاضر',subject:'اللغة العربية'},
    {id:'2',studentUid:'u1',date:'2026-11-24',status:'غائب'},
    {id:'3',studentUid:'u1',date:'2026-11-25',status:'اعتذر'},
    {id:'4',studentUid:'u2',date:'2026-11-25',status:'حاضر'},
    {id:'5',studentUid:'u1',date:'2026-11-26',status:'حاضر'},
    {id:'6',studentUid:'u1',date:'2026-11-20',status:'حاضر'},
    {id:'7',studentUid:'u1',date:'2026-11-25',status:'opened'},
    {id:'8',studentUid:'u1',date:'2026-11-25',status:'حاضر',deleted:true},
    {id:'9',studentUid:'u1',date:'2026-02-31',status:'حاضر'},
  ];
  const x=studentHomeSummary({uid:'u1',attendance,now:new Date('2026-11-25T12:00:00Z')});
  assert.equal(x.present,1);assert.equal(x.absent,1);assert.equal(x.excused,1);assert.equal(x.lastAttendance.id,'1');
  const other=studentHomeSummary({uid:'u2',attendance,now:new Date('2026-11-25T12:00:00Z')});assert.equal(other.present,1);assert.equal(other.lastAttendance.id,'4');
  assert.equal(studentHomeSummary({attendance,now:new Date('2026-11-25T12:00:00Z')}).present,0);
});
test('Repeated document IDs do not double-count attendance',()=>{
  const row={id:'1',studentUid:'u',date:'2026-11-25',status:'حاضر'};
  assert.equal(studentHomeSummary({uid:'u',attendance:[row,row],now:new Date('2026-11-25T12:00:00Z')}).present,1);
});
test('Unverified client grades and inconsistent final grades are excluded',()=>{
  assert.equal(approvedExam({verified:false,score:20,total:20},'codeExamResults'),null);
  assert.equal(approvedExam({verified:true,finalScore:10,finalTotal:20,finalPercent:100},'codeExamResults'),null);
  assert.equal(approvedExam({verified:true,finalScore:10,finalTotal:20,finalPercent:50},'codeExamResults')?.percent,50);
});
test('Reviewed static exams use their final marks and ignore provisional scores',()=>{
  const reviewed={reviewedBy:'admin',reviewedAt:{seconds:1795500000},answers:Array(30).fill('answer'),essayMarks:[1,0,1,1],autoScoreOverride:20,finalScore:23};
  assert.equal(approvedExam(reviewed,'unitOneExamAttempts')?.total,30);
  assert.equal(approvedExam({...reviewed,reviewedBy:''},'unitOneExamAttempts'),null);
  assert.equal(approvedExam({...reviewed,finalScore:30},'unitOneExamAttempts'),null);
  const special={reviewedBy:'admin',reviewedAt:{seconds:1795500000},answers:['a','b'],status:'graded',gradeDetails:[1,0],finalScore:1};
  assert.equal(approvedExam(special,'zad_exam_submissions')?.percent,50);
  assert.equal(approvedExam({...special,gradeDetails:[1,.5],finalScore:1.5},'zad_exam_submissions')?.percent,75);
});
test('Last approved result is the latest review across sources and is tied to UID',()=>{
  const record={studentUid:'u',examTitle:'اختبار',verified:true,finalScore:7,finalTotal:10,finalPercent:70};
  const result=studentHomeSummary({uid:'u',results:{codeExamResults:[{...record,id:'old',reviewedAt:{seconds:100}},{...record,id:'new',reviewedAt:{seconds:200}},{...record,id:'other',studentUid:'other',reviewedAt:{seconds:300}}]},now:new Date('2026-11-25T12:00:00Z')});
  assert.equal(result.lastApproved.id,'new');assert.equal(result.lastAttendance,null);
});
test('Generated index exposes metadata only, no paid links or exam answers',async()=>{
  const raw=await readFile(new URL('../assets/search-index.json',import.meta.url),'utf8');const data=JSON.parse(raw);assert.ok(data.records.length>100);
  assert.doesNotMatch(raw,/https?:\/\/|drive\.google|mega\.nz|"questions"|"answers"|"text"|"storagePath"|"downloadUrl"/i);
  for(const record of data.records)assert.ok(safeSearchHref(record.href));
  const liveCatalog=await readFile(new URL('../store/catalog-data.js',import.meta.url),'utf8');const courses=extractArray(liveCatalog,'baseProducts').filter(x=>x.type==='course'&&x.published!==false&&!x.deleted);
  assert.equal(data.records.filter(x=>x.type==='course').length,courses.length);
});


test('Clear subject names in titles override inaccurate legacy group labels',()=>{
  for(const title of ['المعاصر لغة إنجليزية الصف الأول الإعدادي','مراجعة اللغة الانجليزية','English — Unit 1','إِنْجِلِيزِي الصف الثاني'])
    assert.deepEqual(subjectLabels('لغة عربية',title),['اللغة الإنجليزية']);
  assert.deepEqual(subjectLabels('مواد متنوعة','2ث نحو أدبي'),['النحو']);
  assert.deepEqual(subjectLabels('لغة عربية','المرشد نحو الصف الثاني الثانوي'),['النحو']);
  assert.deepEqual(subjectLabels('مواد متنوعة','النحو والصرف'),['النحو','الصرف']);
  assert.deepEqual(subjectLabels('مواد متنوعة','فِيزيَاء الثاني الثانوي'),['الفيزياء']);
  assert.deepEqual(subjectLabels('مواد متنوعة','المراجعة النهائية في الأحياء'),['الأحياء']);
  assert.deepEqual(subjectLabels('مواد متنوعة','العلوم المتكاملة'),['العلوم المتكاملة']);
  assert.deepEqual(subjectLabels('مواد متنوعة','التاريخ الحديث'),['التاريخ']);
});
test('Ambiguous titles keep source metadata and Arabic language aliases share one facet',()=>{
  assert.deepEqual(subjectLabels('مواد متنوعة','المعاصر للصف الثاني الثانوي'),['مواد متنوعة']);
  assert.deepEqual(subjectLabels('لغة عربية','كتاب الامتحان'),['اللغة العربية']);
  assert.deepEqual(subjectLabels('اللغة العربية','كتاب الامتحان'),['اللغة العربية']);
  assert.deepEqual(subjectLabels('مواد شرعية','مراجعة العلوم الشرعية'),['مواد شرعية']);
  assert.deepEqual(subjectLabels('','مراجعة شاملة'),[]);
});
test('Current English books and second-secondary grammar remain discoverable by the corrected subject filter',async()=>{
  const {records}=JSON.parse(await readFile(new URL('../assets/search-index.json',import.meta.url),'utf8'));
  const englishBooks=searchRecords(records,{query:'english',type:'book'});
  const filteredEnglish=searchRecords(records,{query:'english',type:'book',subject:'اللغة الإنجليزية'});
  assert.ok(englishBooks.length>=5);
  assert.deepEqual(filteredEnglish.map(x=>x.id).sort(),englishBooks.map(x=>x.id).sort());
  for(const id of ['product:lib-118','product:lib-045','product:lib-051','product:lib-049'])
    assert.equal(records.find(x=>x.id===id)?.subject,'اللغة الإنجليزية');
  const grammar=searchRecords(records,{query:'نحو الثاني'});
  const filteredGrammar=searchRecords(records,{query:'نحو الثاني',subject:'النحو'});
  assert.ok(grammar.length>=3);
  assert.deepEqual(filteredGrammar.map(x=>x.id).sort(),grammar.map(x=>x.id).sort());
  assert.ok(records.every(x=>x.subject!=='لغة عربية'));
});
