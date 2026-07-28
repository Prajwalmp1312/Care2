import os
from PIL import Image
import pytesseract
import fitz  # PyMuPDF
from typing import Dict, Any
import re
import pandas as pd
class MedicalRecordAnalyzer:
    def __init__(self):
        """The current analyzer uses deterministic extraction and summarization."""
        self.summarizer = None

    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF file"""
        try:
            text = ""
            doc = fitz.open(file_path)
            for page in doc:
                text += page.get_text()
            doc.close()
            return text.strip()
        except Exception as e:
            print(f"Error extracting PDF text: {e}")
            return ""
    def extract_text_from_excel(self,file_path: str) -> str:
        """Extract text from Excel medical reports (non-tabular safe)"""
        try:
            sheets = pd.read_excel(file_path, sheet_name=None, header=None)
            text = ""

            for sheet_name, sheet in sheets.items():
                text += f"\n--- {sheet_name} ---\n"
                for row in sheet.itertuples(index=False):
                    for cell in row:
                        if pd.notna(cell):
                            text +=str(cell) + " "
                    text += "\n"
            return text.strip()
        except Exception as e:
            print(f"Error extracting Excel text: {e}")
            return ""
    
    def extract_text_from_image(self, file_path: str) -> str:
        """Extract text from image using OCR"""
        try:
            image = Image.open(file_path)
            text = pytesseract.image_to_string(image)
            return text.strip()
        except Exception as e:
            print(f"Error extracting image text: {e}")
            return ""
    
    def extract_text_from_docx(self, file_path: str) -> str:
        """Extract text from DOCX file"""
        try:
            from docx import Document
            doc = Document(file_path)
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            return text.strip()
        except Exception as e:
            print(f"Error extracting DOCX text: {e}")
            return ""
    
    def extract_medical_metrics(self, text: str) -> Dict[str, Any]:
        """Extract key medical metrics from text"""
        metrics = {
            "blood_pressure": [],
            "heart_rate": [],
            "temperature": [],
            "blood_sugar": [],
            "weight": [],
            "height": [],
            "medications": [],
            "diagnoses": []
        }
        
        # Blood Pressure (e.g., 120/80, 120/80 mmHg)
        bp_pattern = r'\b(\d{2,3})/(\d{2,3})\s*(?:mmHg)?\b'
        matches = re.findall(bp_pattern, text)
        metrics["blood_pressure"] = matches
        
        # Heart Rate (e.g., 72 bpm, HR: 72)
        hr_pattern = r'(?:heart rate|HR|pulse)[:\s]*(\d{2,3})\s*(?:bpm)?'
        matches = re.findall(hr_pattern, text, re.IGNORECASE)
        metrics["heart_rate"] = matches
        
        # Temperature (e.g., 98.6°F, 37°C)
        temp_pattern = r'(\d{2,3}(?:\.\d{1,2})?)\s*(?:°|degrees?)\s*(?:F|C|Fahrenheit|Celsius)'
        matches = re.findall(temp_pattern, text, re.IGNORECASE)
        metrics["temperature"] = matches
        
        # Blood Sugar (e.g., 120 mg/dL, glucose: 120)
        sugar_pattern = r'(?:blood sugar|glucose)[:\s]*(\d{2,3})\s*(?:mg/dL)?'
        matches = re.findall(sugar_pattern, text, re.IGNORECASE)
        metrics["blood_sugar"] = matches
        
        # Weight (e.g., 150 lbs, 68 kg)
        weight_pattern = r'(?:weight)[:\s]*(\d{2,3}(?:\.\d{1,2})?)\s*(?:lbs?|kg|pounds?|kilograms?)'
        matches = re.findall(weight_pattern, text, re.IGNORECASE)
        metrics["weight"] = matches
        
        return metrics
    
    # def generate_summary(self, text: str) -> str:
    #     """Generate AI summary of medical text"""
    #     if not text or len(text.strip()) < 50:
    #         return "Insufficient text for analysis."
        
    #     try:
    #         # Clean and prepare text
    #         text = text[:4000]  # Limit length for model
            
    #         if self.summarizer:
    #             summary = self.summarizer(
    #                 text,
    #                 max_length=150,
    #                 min_length=30,
    #                 do_sample=False
    #             )
    #             return summary[0]['summary_text']
    #         else:
    #             # Fallback: Simple extraction
    #             sentences = text.split('.')[:3]
    #             return '. '.join(sentences) + '.'
    #     except Exception as e:
    #         print(f"Error generating summary: {e}")
    #         return "Unable to generate summary at this time."
    def generate_summary(self, text: str) -> str:
        """Generate a lightweight, meaningful summary without heavy model inference."""
        if not text or len(text.strip()) < 30:
            return "Insufficient text for analysis."

        cleaned_text = re.sub(r"\s+", " ", text).strip()

        # Prefer medically relevant sentences when possible
        medical_keywords = [
            "diagnosis", "diagnosed", "abnormal", "normal", "elevated", "reduced",
            "positive", "negative", "impression", "findings", "blood", "glucose",
            "cholesterol", "pressure", "heart", "temperature", "recommend"
        ]

        sentences = re.split(r"(?<=[.!?])\s+", cleaned_text)
        selected = []

        for sentence in sentences:
            sentence_clean = sentence.strip()
            if len(sentence_clean) < 20:
                continue
            if any(keyword in sentence_clean.lower() for keyword in medical_keywords):
                selected.append(sentence_clean)
            if len(selected) >= 5:
                break

        if not selected:
            selected = [s.strip() for s in sentences if len(s.strip()) > 20][:3]

        summary = " ".join(selected).strip()
        if not summary:
            return "Medical record uploaded. Limited text was available for summary generation."

        return summary[:1200]
  

    
    def analyze_record(self, file_path: str, file_type: str) -> Dict[str, Any]:
        """Main analysis function"""
        result = {
            "text_extracted": "",
            "summary": "",
            "metrics": {},
            "key_findings": [],
            "word_count": 0
        }
        
        # Extract text based on file type
        if file_type.lower().endswith('.pdf'):
            result["text_extracted"] = self.extract_text_from_pdf(file_path)
        elif file_type.lower() in ['.jpg', '.jpeg', '.png', '.tiff', '.bmp']:
            result["text_extracted"] = self.extract_text_from_image(file_path)
        elif file_type.lower() in ['.docx', '.doc']:
            result["text_extracted"] = self.extract_text_from_docx(file_path)
        elif file_type.lower() in ['.xls', '.xlsx']:
            result["text_extracted"] = self.extract_text_from_excel(file_path)

        elif file_type.lower() == '.txt':
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                result["text_extracted"] = f.read()
    
       
           
        # Analyze extracted text
        if result["text_extracted"]:
            result["word_count"] = len(result["text_extracted"].split())
            result["summary"] = self.generate_summary(result["text_extracted"])
            result["metrics"] = self.extract_medical_metrics(result["text_extracted"])
            
            # Generate key findings
            result["key_findings"] = self.extract_key_findings(result["text_extracted"])
        else:
            result["summary"] = "Unable to extract readable text from this file. Please upload a clearer or text-based document for better analysis."
        
        return result
    
    def extract_key_findings(self, text: str) -> list:
        """Extract key findings from medical text"""
        findings = []
        
        # Look for common medical keywords
        keywords = [
            "diagnosis", "diagnosed", "condition", "disease",
            "abnormal", "normal", "elevated", "reduced",
            "positive", "negative", "acute", "chronic"
        ]
        
        sentences = text.split('.')
        for sentence in sentences:
            sentence_lower = sentence.lower()
            if any(keyword in sentence_lower for keyword in keywords):
                clean_sentence = sentence.strip()
                if clean_sentence and len(clean_sentence) > 20:
                    findings.append(clean_sentence)
                    if len(findings) >= 5:  # Limit to 5 key findings
                        break
        
        return findings


def generate_health_summary(records_analysis: list, patient_info: dict) -> Dict[str, Any]:
    """
    Generate comprehensive health summary from all medical records
    """
    summary = {
        "overall_status": "Good",
        "total_records": len(records_analysis),
        "recent_findings": [],
        "vital_trends": {},
        "medications": set(),
        "chronic_conditions": set(),
        "recommendations": []
    }

    all_bp = []
    all_hr = []
    all_temp = []
    all_findings = []
    abnormal_count = 0

    abnormal_keywords = [
        "abnormal", "critical", "positive", "severe",
        "elevated", "high", "low",
        "acute", "emergency", "icu",
        "myocardial", "infarction",
        "cardiac", "admitted", "stroke", "failure"
    ]

    def update_status(next_status: str):
        order = {"Good": 0, "Needs Attention": 1, "Critical": 2}
        if order.get(next_status, 0) > order.get(summary["overall_status"], 0):
            summary["overall_status"] = next_status

    for record in records_analysis:
        if record.get("metrics"):
            metrics = record["metrics"]
            all_bp.extend(metrics.get("blood_pressure", []))
            all_hr.extend(metrics.get("heart_rate", []))
            all_temp.extend(metrics.get("temperature", []))

        if record.get("key_findings"):
            all_findings.extend(record["key_findings"])

        finding_sources = list(record.get("key_findings", []))
        if record.get("summary"):
            finding_sources.append(record.get("summary", ""))

        for finding in finding_sources:
            if any(word in finding.lower() for word in abnormal_keywords):
                abnormal_count += 1
                break

    # Blood Pressure trend
    if all_bp:
        avg_systolic = sum(int(bp[0]) for bp in all_bp[-5:]) / min(len(all_bp), 5)
        avg_diastolic = sum(int(bp[1]) for bp in all_bp[-5:]) / min(len(all_bp), 5)
        summary["vital_trends"]["blood_pressure"] = f"{int(avg_systolic)}/{int(avg_diastolic)} mmHg (Average)"

        if avg_systolic >= 180 or avg_diastolic >= 120:
            update_status("Critical")
            summary["recommendations"].append(
                "Severely elevated blood pressure detected. Seek urgent medical attention."
            )
        elif avg_systolic > 140 or avg_diastolic > 90 or avg_systolic < 90 or avg_diastolic < 60:
            update_status("Needs Attention")
            summary["recommendations"].append(
                "Blood pressure readings are outside the normal range. Please consult your doctor."
            )

    # Heart Rate trend
    if all_hr:
        avg_hr = sum(int(hr) for hr in all_hr[-5:]) / min(len(all_hr), 5)
        summary["vital_trends"]["heart_rate"] = f"{int(avg_hr)} bpm (Average)"

        if avg_hr > 140 or avg_hr < 40:
            update_status("Critical")
            summary["recommendations"].append(
                "Heart rate indicates possible acute risk. Seek immediate medical evaluation."
            )
        elif avg_hr > 120 or avg_hr < 50:
            update_status("Needs Attention")
            summary["recommendations"].append(
                "Heart rate appears outside normal resting range. Discuss with your clinician."
            )

    # Temperature trend
    if all_temp:
        parsed_temps = []
        for temp in all_temp[-5:]:
            try:
                parsed_temps.append(float(temp))
            except (TypeError, ValueError):
                continue

        if parsed_temps:
            avg_temp = sum(parsed_temps) / len(parsed_temps)
            summary["vital_trends"]["temperature"] = f"{avg_temp:.1f}°"

            if avg_temp >= 39.5 or avg_temp < 35.0:
                update_status("Critical")
                summary["recommendations"].append(
                    "Temperature trend indicates potential emergency. Seek urgent care."
                )
            elif avg_temp >= 38.0:
                update_status("Needs Attention")
                summary["recommendations"].append(
                    "Persistent fever pattern detected. Clinical review is recommended."
                )

    # Escalate status
    if abnormal_count >= 2:
        update_status("Needs Attention")
        summary["recommendations"].append(
            "Multiple abnormal findings detected. Medical review is advised."
        )

    if abnormal_count >= 4:
        update_status("Critical")
        summary["recommendations"].append(
            "Critical health indicators detected. Immediate medical attention required."
        )

    summary["recent_findings"] = all_findings[-3:] if all_findings else [
        "Medical records uploaded, but no structured health data detected."
    ]

    if not summary["recommendations"]:
        summary["recommendations"] = [
            "Continue regular check-ups with your healthcare provider.",
            "Maintain a healthy diet and exercise routine.",
            "Keep all medical records updated."
        ]

    # ✅ BUILD FINAL HUMAN-READABLE SUMMARY
    parts = []

    parts.append(
        f"Overall health status is {summary['overall_status']} based on analysis of "
        f"{summary['total_records']} medical records."
    )

    if summary["vital_trends"]:
        for vital, value in summary["vital_trends"].items():
            parts.append(f"{vital.replace('_', ' ').title()} trend: {value}.")

    if summary["recent_findings"]:
        parts.append("Key findings include:")
        for finding in summary["recent_findings"]:
            parts.append(f"- {finding}")

    if summary["recommendations"]:
        parts.append("Recommendations:")
        for rec in summary["recommendations"]:
            parts.append(f"- {rec}")

    summary["summary"] = " ".join(parts)

    return summary
