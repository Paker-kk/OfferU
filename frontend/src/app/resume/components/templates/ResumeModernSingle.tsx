import type { NormalizedResumeData } from "./templateSettings";
import { ContactLine, HighlightText, RichSummary, SectionBlock, sortSections } from "./shared";

export function ResumeModernSingle({
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
        <div className="modern-name-underline" />
        {data.title && (
          <p className="resume-title">
            <HighlightText text={data.title} keywords={highlightKeywords} />
          </p>
        )}
        <ContactLine data={data} />
      </header>
      {data.summary && (
        <section className="resume-section">
          <h3 className="resume-section-title-accent">Summary</h3>
          <div className="text-justify">
            <RichSummary data={data} keywords={highlightKeywords} />
          </div>
        </section>
      )}
      {sections.map((section) => (
        <SectionBlock key={section.id} section={section} accent keywords={highlightKeywords} />
      ))}
    </>
  );
}
