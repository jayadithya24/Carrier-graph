import os
import tempfile
import pdfplumber
import docx
import re

SKILL_KEYWORDS = [
    # Add more as needed or load from DB
    'python', 'java', 'sql', 'neo4j', 'flask', 'react', 'javascript', 'css', 'html', 'docker', 'git', 'linux',
]

EDUCATION_KEYWORDS = [
    'bachelor', 'master', 'phd', 'university', 'college', 'degree', 'diploma', 'school', 'education'
]

EXPERIENCE_KEYWORDS = [
    'experience', 'intern', 'project', 'work', 'employment', 'company', 'role', 'position'
]

def extract_text_from_pdf(file_stream):
    with pdfplumber.open(file_stream) as pdf:
        text = "\n".join(page.extract_text() or '' for page in pdf.pages)
    return text

def extract_text_from_docx(file_stream):
    doc = docx.Document(file_stream)
    text = "\n".join([p.text for p in doc.paragraphs])
    return text

def extract_skills(text, skill_list=None):
    if skill_list is None:
        skill_list = SKILL_KEYWORDS
    found = set()
    for skill in skill_list:
        pattern = r"\\b" + re.escape(skill) + r"\\b"
        if re.search(pattern, text, re.IGNORECASE):
            found.add(skill)
    return sorted(found)

def extract_education(text):
    lines = text.splitlines()
    edu_lines = [l for l in lines if any(k in l.lower() for k in EDUCATION_KEYWORDS)]
    return edu_lines

def extract_experience(text):
    lines = text.splitlines()
    exp_lines = [l for l in lines if any(k in l.lower() for k in EXPERIENCE_KEYWORDS)]
    return exp_lines

def parse_resume(file_stream, filename, skill_list=None):
    ext = os.path.splitext(filename)[-1].lower()
    if ext == '.pdf':
        text = extract_text_from_pdf(file_stream)
    elif ext == '.docx':
        text = extract_text_from_docx(file_stream)
    else:
        raise ValueError('Unsupported file type')
    skills = extract_skills(text, skill_list)
    education = extract_education(text)
    experience = extract_experience(text)
    return {
        'skills': skills,
        'education': education,
        'experience': experience
    }
