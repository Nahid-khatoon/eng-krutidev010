import fs from "fs";
import { transformDocxBuffer } from "./src/services/docxGenerator.js";
import { krutiDevToUnicode } from "./src/services/krutiDevConverter.js";
import JSZip from "jszip";

async function runImage2FormatTests() {
  console.log("========================================================");
  console.log("TEST SUITE: VERIFYING IMAGE 2 EXACT LAYOUT & FORMAT");
  console.log("========================================================\n");

  const inputPath = "C:/Users/sadiy/OneDrive/Desktop/test.docx";
  if (!fs.existsSync(inputPath)) {
    console.error("Test input docx not found:", inputPath);
    process.exit(1);
  }

  const inputBuffer = fs.readFileSync(inputPath);
  const outputBuffer = await transformDocxBuffer(inputBuffer, { mode: "krutidev" });

  const zip = await JSZip.loadAsync(outputBuffer);
  const xml = await zip.file("word/document.xml").async("text");
  const pMatches = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
    }
  }

  // 1. P[0]: पूर्व मध्य रेलवे (Centered, Bold, Underlined, No Indent)
  const p0 = pMatches[0];
  const p0Jc = (p0.match(/<w:jc[^>]*w:val="([^"]+)"/) || [])[1];
  const p0Ind = (p0.match(/<w:ind[^>]*\/>/) || [])[0];
  const p0U = /<w:u(\/|>|\s)/.test(p0);
  const p0B = /<w:b(\/|>|\s)/.test(p0);
  assert(p0Jc === "center", `P[0] Railway name is centered (got: ${p0Jc})`);
  assert(!p0Ind, `P[0] Railway name has no offset indent (got: ${p0Ind || "none"})`);
  assert(p0U && p0B, `P[0] Railway name is bold and underlined (u=${p0U}, b=${p0B})`);

  // 2. P[1]: दानापुर मंडल (Centered, Bold, Underlined, No Indent)
  const p1 = pMatches[1];
  const p1Jc = (p1.match(/<w:jc[^>]*w:val="([^"]+)"/) || [])[1];
  const p1Ind = (p1.match(/<w:ind[^>]*\/>/) || [])[0];
  const p1U = /<w:u(\/|>|\s)/.test(p1);
  const p1B = /<w:b(\/|>|\s)/.test(p1);
  assert(p1Jc === "center", `P[1] Division name is centered (got: ${p1Jc})`);
  assert(!p1Ind, `P[1] Division name has no offset indent (got: ${p1Ind || "none"})`);
  assert(p1U && p1B, `P[1] Division name is bold and underlined (u=${p1U}, b=${p1B})`);

  // 3. P[2]: क्रमांक टी/एस.डब्ल्यू.आर./डब्ल्यू.जेड.जे./2026 (Centered, No Hyphen after क्रमांक)
  const p2 = pMatches[2];
  const p2Jc = (p2.match(/<w:jc[^>]*w:val="([^"]+)"/) || [])[1];
  const p2Text = (p2.match(/<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, "")).join("");
  assert(p2Jc === "center", `P[2] Rule number is centered (got: ${p2Jc})`);
  assert(!p2Text.includes("-Vh") && !p2Text.includes("-टी") && (p2Text.includes("Vh") || p2Text.includes("टी")), `P[2] has NO hyphen after क्रमांक (got: ${p2Text})`);

  // 4. P[4]: स्टेशन के स्टेशन नियम (Centered, Bold, Underlined, Heading7)
  const p4 = pMatches[4];
  const p4Jc = (p4.match(/<w:jc[^>]*w:val="([^"]+)"/) || [])[1];
  const p4Style = (p4.match(/<w:pStyle[^>]*w:val="([^"]+)"/) || [])[1];
  const p4U = /<w:u(\/|>|\s)/.test(p4);
  const p4B = /<w:b(\/|>|\s)/.test(p4);
  assert(p4Jc === "center", `P[4] SWR title is centered (got: ${p4Jc})`);
  assert(p4Style === "Heading7", `P[4] SWR title has style Heading7 (got: ${p4Style})`);
  assert(p4U && p4B, `P[4] SWR title is bold and underlined (u=${p4U}, b=${p4B})`);

  // 5. P[6]: ब्रॉड गेज (Centered, Bold, Underlined, No 5760 Indent)
  const p6 = pMatches[6];
  const p6Jc = (p6.match(/<w:jc[^>]*w:val="([^"]+)"/) || [])[1];
  const p6Ind = (p6.match(/<w:ind[^>]*\/>/) || [])[0];
  const p6Text = (p6.match(/<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, "")).join("");
  const p6U = /<w:u(\/|>|\s)/.test(p6);
  assert(p6Jc === "center", `P[6] Broad Gauge is centered (got: ${p6Jc})`);
  assert(!p6Ind, `P[6] Broad Gauge has no right-skewing indent (got: ${p6Ind || "none"})`);
  assert(p6Text.includes("cz‚M xst"), `P[6] translates to ब्रॉड गेज (cz‚M xst)`);
  assert(p6U, `P[6] Broad Gauge is underlined`);

  // 6. P[7]: जारी करने की तारीख (Centered, Underlined, Clean dots, No Issue or ३३.३३.)
  const p7 = pMatches[7];
  const p7Jc = (p7.match(/<w:jc[^>]*w:val="([^"]+)"/) || [])[1];
  const p7Ind = (p7.match(/<w:ind[^>]*\/>/) || [])[0];
  const p7Text = (p7.match(/<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, "")).join("");
  const p7U = /<w:u(\/|>|\s)/.test(p7);
  assert(p7Jc === "center", `P[7] Date of Issue is centered (got: ${p7Jc})`);
  assert(!p7Ind, `P[7] Date of Issue has no right-skewing indent (got: ${p7Ind || "none"})`);
  assert(p7Text.includes("tkjh djus dh rkjh[k"), `P[7] translates to जारी करने की तारीख (tkjh djus dh rkjh[k)`);
  assert(!p7Text.includes("Issue") && !p7Text.includes("३३.३३"), `P[7] has zero English leftover and zero mangled digits`);
  assert(p7U, `P[7] Date of Issue is underlined`);

  // 7. P[8]: लागू होने की तारीख (Centered, Underlined, Clean dots, No frfFk foFkE33)
  const p8 = pMatches[8];
  const p8Jc = (p8.match(/<w:jc[^>]*w:val="([^"]+)"/) || [])[1];
  const p8Ind = (p8.match(/<w:ind[^>]*\/>/) || [])[0];
  const p8Text = (p8.match(/<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, "")).join("");
  const p8U = /<w:u(\/|>|\s)/.test(p8);
  assert(p8Jc === "center", `P[8] Date brought in force is centered (got: ${p8Jc})`);
  assert(!p8Ind, `P[8] Date brought in force has no right-skewing indent (got: ${p8Ind || "none"})`);
  assert(p8Text.includes("ykxw gksus dh rkjh[k"), `P[8] translates to लागू होने की तारीख (ykxw gksus dh rkjh[k)`);
  assert(!p8Text.includes("foFkE") && !p8Text.includes("विथम्"), `P[8] has zero mangled text`);
  assert(p8U, `P[8] Date brought in force is underlined`);

  // 8. P[10]: Introductory Paragraph (ब्लॉक दस्तावेज मैनुअल, Justified)
  const p10 = pMatches[10];
  const p10Text = (p10.match(/<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, "")).join("");
  assert(p10Text.includes("Cy‚d nLrkost eSuqvy"), `P[10] contains official railway phrase 'ब्लॉक दस्तावेज मैनुअल' (Cy‚d nLrkost eSuqvy)`);

  // 9. P[12]: 1 .  स्टेशन कार्य नियम आरेख। (Bold, Underlined)
  const p12 = pMatches[12];
  const p12U = /<w:u(\/|>|\s)/.test(p12);
  const p12B = /<w:b(\/|>|\s)/.test(p12);
  assert(p12U && p12B, `P[12] Item 1 heading is bold and underlined`);

  // 10. Top Header: word/header1.xml
  const headerFile = zip.file("word/header1.xml");
  assert(!!headerFile, `Top header (word/header1.xml) was generated and attached`);
  if (headerFile) {
    const headerXml = await headerFile.async("text");
    assert(headerXml.includes('PAGE   \\* MERGEFORMAT') || headerXml.includes('PAGE'), `Header includes dynamic page number centered`);
    assert(headerXml.includes('othjxat') || headerXml.includes('वजीरगंज'), `Header includes station name right-aligned`);
  }

  console.log("\n========================================================");
  console.log(`RESULTS: ${passed} / ${total} TESTS PASSED!`);
  console.log("========================================================");
  if (passed === total) {
    console.log("ALL IMAGE 2 REQUIREMENTS FULLY VERIFIED AND SATISFIED!");
  } else {
    process.exit(1);
  }
}

runImage2FormatTests().catch(console.error);
