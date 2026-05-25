import type { NormalizedResumeData } from "./templateSettings";
import { ContactLine, HighlightText, RichSummary, SectionBlock, splitTwoColumnSections } from "./shared";

export function ResumeModernTwoColumn({
  data,
  highlightKeywords,
}: {
  data: NormalizedResumeData;
  highlightKeywords: string[];
}) {
  const { main, sidebar } = splitTwoColumnSections(data);
  return (
    <>
      <header className="resume-header">
        <h1 className="resume-name modern-name-accent">{data.userName || "Your Name"}</h1>
        {data.title && (
          <p className="resume-title">
            <HighlightText text={data.title} keywords={highlightKeywords} />
          </p>
        )}
        <ContactLine data={data} />
      </header>
      <div className="modern-two-column">
        <main className="modern-two-column-main">
          {data.summary && (
            <section className="resume-section">
              <h3 className="resume-section-title-accent">Summary</h3>
              <div className="text-justify">
                <RichSummary data={data} keywords={highlightKeywords} />
              </div>
            </section>
          )}
          {main.map((section) => (
            <SectionBlock key={section.id} section={section} accent keywords={highlightKeywords} />
          ))}
        </main>
        <aside className="modern-two-column-sidebar">
          {sidebar.map((section) => (
            <SectionBlock key={section.id} section={section} accent small keywords={highlightKeywords} />
          ))}
        </aside>
      </div>
    </>
  );
}
