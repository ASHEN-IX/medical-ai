#!/usr/bin/env python3
"""Test script to validate autism parser with actual report data."""

import sys
import json
from pathlib import Path

# Add ai-service to path
sys.path.insert(0, str(Path(__file__).parent / "ai-service"))

from app.services.autism_parser import parse_autism_prediction_request
from app.services.ocr_service import OCRService

def test_parser_with_report_data():
    """Test parser with the exact M-CHAT report data."""
    
    # This is the exact M-CHAT report from the user
    report_text = """
Patient NameN/A (Self-Report)Patient IDASD-2026-002
Date of ReportApril 29, 2026Exam TypeDevelopmental
Screening (M-CHAT)
Age / Gender7 years · MaleEthnicityWhite-European
Country of ResidenceUnited StatesInformantSelf
Jaundice at BirthNoPrior Screening AppNo
M-CHAT Screening Responses
ItemQuestion Response
A1Does the child look at you when you call their name?Yes
A2Does the child use pointing to show interest?Yes
A3Does the child engage in pretend play?Yes
A4Does the child show interest in other children?Yes
A5Does the child bring objects to show you?Yes
A6Does the child make eye contact with you?Yes
A7Does the child imitate your actions?Yes
A8Does the child respond to their name being called?Yes
A9Does the child use simple gestures?Yes
A10Does the child smile in response to your smile?Yes
"""
    
    print("=" * 80)
    print("TEST 1: Parser with M-CHAT Report Data")
    print("=" * 80)
    print(f"Report text length: {len(report_text)}")
    
    try:
        result = parse_autism_prediction_request(report_text)
        
        print(f"\n✓ Parser succeeded!")
        print(f"\nExtracted Demographics:")
        print(f"  Age: {result.demographics.age}")
        print(f"  Gender: {result.demographics.gender} (0=male, 1=female)")
        print(f"  Ethnicity: {result.demographics.ethnicity}")
        print(f"  Relation: {result.demographics.relation}")
        print(f"  Jaundice: {result.demographics.jaundice}")
        print(f"  Family History (austim): {result.demographics.austim}")
        print(f"  Used App Before: {result.demographics.used_app_before}")
        print(f"  Country of Residence: {result.demographics.contry_of_res}")
        
        print(f"\nExtracted Survey Responses:")
        responses_dict = result.responses.model_dump() if hasattr(result.responses, "model_dump") else result.responses.dict()
        total_yes = 0
        for i in range(1, 11):
            key = f"A{i}_Score"
            value = responses_dict.get(key, 0)
            total_yes += value
            print(f"  A{i}: {value}")
        
        print(f"\nTotal YES responses: {total_yes}/10")
        print(f"Expected: 10/10 (all YES in the report)")
        
        if total_yes == 10:
            print("✓ PASS: All 10 responses correctly parsed as 1 (YES)")
        else:
            print(f"✗ FAIL: Expected 10 but got {total_yes}")
            
    except Exception as e:
        print(f"✗ Parser failed with error: {e}")
        import traceback
        traceback.print_exc()


def test_ocr_extraction():
    """Test OCR extraction from the PDF file."""
    print("\n" + "=" * 80)
    print("TEST 2: OCR Extraction from autistic.pdf")
    print("=" * 80)
    
    pdf_path = Path(__file__).parent / "autistic.pdf"
    
    if not pdf_path.exists():
        print(f"✗ PDF file not found: {pdf_path}")
        return
    
    try:
        with open(pdf_path, "rb") as f:
            file_bytes = f.read()
        
        ocr_service = OCRService()
        
        # Detect file type
        file_type = ocr_service.detect_file_type(file_bytes, "autistic.pdf", "application/pdf")
        print(f"Detected file type: {file_type}")
        
        # Extract text
        if file_type == "pdf":
            result = ocr_service.extract_text_from_pdf(file_bytes)
        else:
            result = ocr_service.extract_text_from_image(file_bytes)
        
        print(f"Extraction method: {result.extraction_method}")
        print(f"Extracted text length: {len(result.text)}")
        print(f"\nFirst 500 characters of extracted text:")
        print("-" * 80)
        print(result.text[:500])
        print("-" * 80)
        
        # Now parse the extracted text
        print("\nParsing extracted text...")
        parsed_result = parse_autism_prediction_request(result.text)
        
        print(f"\n✓ Parser succeeded on OCR text!")
        print(f"\nExtracted Demographics from PDF:")
        print(f"  Age: {parsed_result.demographics.age}")
        print(f"  Gender: {parsed_result.demographics.gender}")
        print(f"  Ethnicity: {parsed_result.demographics.ethnicity}")
        print(f"  Relation: {parsed_result.demographics.relation}")
        
        responses_dict = parsed_result.responses.model_dump() if hasattr(parsed_result.responses, "model_dump") else parsed_result.responses.dict()
        total_yes = sum(1 for i in range(1, 11) if responses_dict.get(f"A{i}_Score", 0) == 1)
        print(f"  Total YES responses: {total_yes}/10")
        
    except Exception as e:
        print(f"✗ OCR extraction failed: {e}")
        import traceback
        traceback.print_exc()


def test_api_call():
    """Test the full API call with the report data."""
    print("\n" + "=" * 80)
    print("TEST 3: Full API Call with M-CHAT Report")
    print("=" * 80)
    
    import requests
    
    report_text = """
Patient NameN/A (Self-Report)Patient IDASD-2026-002
Date of ReportApril 29, 2026Exam TypeDevelopmental
Screening (M-CHAT)
Age / Gender7 years · MaleEthnicityWhite-European
Country of ResidenceUnited StatesInformantSelf
Jaundice at BirthNoPrior Screening AppNo
M-CHAT Screening Responses
ItemQuestion Response
A1Does the child look at you when you call their name?Yes
A2Does the child use pointing to show interest?Yes
A3Does the child engage in pretend play?Yes
A4Does the child show interest in other children?Yes
A5Does the child bring objects to show you?Yes
A6Does the child make eye contact with you?Yes
A7Does the child imitate your actions?Yes
A8Does the child respond to their name being called?Yes
A9Does the child use simple gestures?Yes
A10Does the child smile in response to your smile?Yes
"""
    
    payload = {
        "report_type": "general",
        "features": {},
        "raw_text": report_text,
        "include_explanation": False,
        "symptoms": []
    }
    
    try:
        response = requests.post(
            "http://localhost:8001/api/v1/diagnosis/analyze",
            json=payload,
            timeout=15
        )
        
        print(f"Status Code: {response.status_code}")
        result = response.json()
        
        print(f"\nAPI Response:")
        print(f"  Report Type: {result.get('report_type')}")
        print(f"  Selected Disease: {result.get('selected_disease')}")
        print(f"  Overall Risk: {result.get('overall_risk')}")
        print(f"  Success: {result.get('success')}")
        
        if result.get('success'):
            print("\n✓ API call succeeded!")
            if result.get('overall_risk') == 'HIGH':
                print("✓ PASS: Risk correctly identified as HIGH (10/10 responses)")
            else:
                print(f"✗ WARN: Expected HIGH risk but got {result.get('overall_risk')}")
        else:
            print(f"\n✗ API call failed: {result.get('error')}")
        
        print(f"\nFull response:")
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"✗ API call failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("AUTISM PARSER TEST SUITE")
    print("=" * 80)
    
    test_parser_with_report_data()
    test_ocr_extraction()
    test_api_call()
    
    print("\n" + "=" * 80)
    print("TEST SUITE COMPLETE")
    print("=" * 80)
