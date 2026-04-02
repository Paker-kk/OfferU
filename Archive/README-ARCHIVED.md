# ✨ DailyJobMatch


> **Automated AI-powered job-matching workflow built with n8n**


## Overview
### 🧠 What DailyJobMatch does


DailyJobMatch automates your job search by running every morning, collecting fresh job postings, matching each role against your CV using a large language model, and then sending you a ranked shortlist of the most relevant positions directly to your inbox.


### ⭐ Core features


- 🔄 **Daily automation**: Scheduled trigger (e.g. 07:30) runs the entire pipeline without manual effort.
- 📝 **CV-aware matching**: Uses the full text of your CV, not just keywords, to evaluate fit.
- 💯 **Multi-dimensional scoring**: Breaks fit into background match, skills overlap, experience relevance, seniority, language requirements, and company score.
- 🧹 **Job cleaning & deduplication**: Normalises fields, removes obvious mismatches (student roles, internships, postdocs), and deduplicates by title/company/link.
- 📊 **Structured LLM output**: Forces the model to return strict JSON, then parses and validates it before ranking.
- 🥇 **Top-N selection**: Ranks all jobs by overall score and keeps only the top matches for you to review.
- 💌 **Nice email report**: Sends a dark-theme HTML digest with job cards, scores, keywords, fit bullets, and “View & Apply” buttons.


### 🏗️ Architecture Diagram


<img width="2268" height="386" alt="image" src="https://github.com/user-attachments/assets/7ceafeef-1611-4131-9f8b-03a719967199" />
<img width="2565" height="406" alt="image" src="https://github.com/user-attachments/assets/5b406f69-ec06-4b07-aae6-ad858304abda" />


## 📘 How to use?


> As it is still an early stage of the project, I'm still looking for methods to make it easy to use. Now it still needs lots of personalised writing and configuration.


### 🏗️ Installing & Running n8n with Docker
DailyJobMatch is built on n8n, a powerful automation tool. Docker is the recommended and easiest deployment method. For more information, please see:
https://github.com/n8n-io/n8n


### 🔐 Setting Up Required Credentials
DailyJobMatch relies on several external services to retrieve your CV, scrape job listings, score them using an LLM, and send your daily email report.


Google Drive (retrieve CV) and Gmail (send job digest email) nodes required the **Google credentials**, and here are the official docs from n8n:


> https://docs.n8n.io/integrations/builtin/credentials/google/




In our workflow, [Apify](https://console.apify.com) is used to collect fresh LinkedIn jobs within the last 24 hours. Apify provides tons of actors to scrape up-to-date web data from any website for AI apps and agents, and I chose [**_Linkedin Jobs Scraper - PPR_**](https://apify.com/curious_coder/linkedin-jobs-scraper) as it is paid by result rather than subscription. But feel free to choose the scrapper which fits your needs, and the detailed configuration steps will be on the actor's page. 


DailyJobMatch uses an LLM to read your job description, read your CV, evaluate the matches and score the fit across 6 dimensions and finally generate structured JSON outputs. n8n can be integrated with almost all the conversational chatbots. Here's how you can set up with the **OpenAI model**:


> https://docs.n8n.io/integrations/builtin/credentials/openai/


### 📘 Importing & Configuring Workflow
Once you prepare the Docker environment and required credentials, it's time to import and configure the workflow based on your own needs and credentials. My workflow is stored as workflow/Job_Hunting_Agent.json, and you can download the file and import this file into n8n. 


> PS: Please replace my credentials with yours. Don't use my credentials to test or run anything.


I've written a few lines of descriptions for each node, and feel free to click and check the official docs to learn more. Here I will just walk through these key nodes, which you may need to alter or customise based on your needs:

- **Config**: add your LinkedIn scrapper api (NOT the full link, check LinkedIn node), email address which receives the email, as well as how many jobs you want to receive per day.
- **RetrieveCV (Google Drive)**: Under Credentials, select your Google Drive OAuth2 credential and make sure the file / fileId is set to your CV PDF.
- **Linkedin**: Under URL or body, make sure it uses your Apify dataset or actor endpoint (depending on how you configured it). Under Authentication / Headers, ensure your Apify API token is set
- **Filter and deduplicate**: modify the JavaScript which specifies the banned keywords in the job description (like student, temporary...)
- **Score the job and extract**: customise the prompt for your agent, including the goals, input and tasks.
- **Model nodes**: finish credentials setting and choose your model.
- **Send a message (Gmail)**: Under Credentials, choose your Gmail OAuth2 credential. Ensure the To field is either A static email or an expression pointing to Config.gmailTo.

> Sanity Check: Run in Manual Mode:
> Before relying on the schedule, do one full test run. Disable the Schedule Trigger and then click Execute Workflow. You could watch the execution step by step, and if any step fails, you could check the input and output of the previous nodes and debug. 

### Output:
For my customised agent, inside the scoring node, the model must:
- Read the entire CV
- Read the entire job description
- Assess fit using six categories
- Produce a strict JSON object (no markdown, no explanations)
- Keep the format consistent across runs
The scoring rubric enforces structured evaluation. The final JSON looks like:
```
 {
  "score": {
    "overall": 0,
    "background_match": 0,
    "skills_overlap": 0,
    "experience_relevance": 0,
    "seniority": 0,
    "language_requirement": 0,
    "company_score": 0
  },
  "summary": "",
  "keywords": [],
  "fit_bullets": [],
  "connector": ""
}
```
| Category              | Range  | Description                                                        |
|-----------------------|--------|--------------------------------------------------------------------|
| **background_match**  | 0–10   | Relevance of job domain (bioinformatics, pharma, biotech)         |
| **skills_overlap**    | 0–30   | Match between required skills and your programming/technical stack |
| **experience_relevance** | 0–30 | Match between responsibilities & your past projects/work           |
| **seniority**         | 0–10   | Entry-level preference; penalizes manager/senior roles             |
| **language_requirement** | 0–10 | Penalizes strict “Danish required” roles                           |
| **company_score**     | 0–10   | Bonus for biotech/pharma/AI companies                              |
| **overall**           | 0–100  | Must equal the sum of all above                                   |

Here's an example of DailyJobMatch Email Output:

<p align="center">
  <img src="https://github.com/user-attachments/assets/30da81d5-ba15-43fc-8345-aebe2c4ac42c" width="500" alt="DailyJobMatch workflow demo">
</p>

## 📬 Contact

If you want to reach out directly:

- **Author:** Chunxu Han  
- **Email:** s220311@dtu.dk  
- **LinkedIn:** https://www.linkedin.com/in/chunxu-han  

Feel free to share feedback, ask questions, or suggest new features!

---

## 🌟 Roadmap

Planned improvements:

- JobIndex / StepStone / Indeed integrations  
- Notion or Supabase job-tracking storage  
- Auto-apply system (draft cover letters)  
- Multi-country job searches  
- Weekly analytics report (Grafana/Supabase)  
- AI-based CV improvement suggestions  

Have an idea? Open an issue or PR!

---

