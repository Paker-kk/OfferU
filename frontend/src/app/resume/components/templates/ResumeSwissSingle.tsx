import type { NormalizedResumeData } from "./templateSettings";
import { ContactLine, HighlightText, RichSummary, SectionBlock, sortSections } from "./shared";

export function ResumeSwissSingle({
  data,
  highlightKeywords,
}: {
  data: NormalizedResumeData;
  highlightKeywords: string[];
}) {
  const sections = sortSections(data);
  return (
    <>
      <header className="resume-header text-center">
        <h1 className="resume-name">{data.userName || "Your Name"}</h1>
        {data.title && (
          <p className="resume-title">
            <HighlightText text={data.title} keywords={highlightKeywords} />
          </p>
        )}
        <ContactLine data={data} />
      </header>
      {data.summary && (
        <section className="resume-section">
          <h3 className="resume-section-title">Summary</h3>
          <div className="text-justify">
            <RichSummary data={data} keywords={highlightKeywords} />
          </div>
        </section>
      )}
      {sections.map((section) => (
        <SectionBlock key={section.id} section={section} keywords={highlightKeywords} />
      ))}
    </>
  );
}
