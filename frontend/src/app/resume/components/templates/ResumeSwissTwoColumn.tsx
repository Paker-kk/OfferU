import type { NormalizedResumeData } from "./templateSettings";
import { ContactLine, HighlightText, RichSummary, SectionBlock, splitTwoColumnSections } from "./shared";

export function ResumeSwissTwoColumn({
  data,
  highlightKeywords,
}: {
  data: NormalizedResumeData;
  highlightKeywords: string[];
}) {
  const { main, sidebar } = splitTwoColumnSections(data);
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
      <div className="swiss-two-column">
        <main className="swiss-two-column-main">
          {data.summary && (
            <section className="resume-section">
              <h3 className="resume-section-title">Summary</h3>
              <div className="text-justify">
                <RichSummary data={data} keywords={highlightKeywords} />
              </div>
            </section>
          )}
          {main.map((section) => (
            <SectionBlock key={section.id} section={section} keywords={highlightKeywords} />
          ))}
        </main>
        <aside className="swiss-two-column-sidebar">
          {sidebar.map((section) => (
            <SectionBlock key={section.id} section={section} small keywords={highlightKeywords} />
          ))}
        </aside>
      </div>
    </>
  );
}
