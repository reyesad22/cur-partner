"""
Test cases for PDF upload and script parsing functionality.
Tests the fix for PDF upload that was silently failing showing '0 lines, 0 characters'.
"""
import pytest
import requests
import os
from fpdf import FPDF
import io
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "actor@demo.com"
TEST_PASSWORD = "actor123"


class TestPDFUpload:
    """Test PDF upload and parsing functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token and create test project"""
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create test project
        response = requests.post(f"{BASE_URL}/api/projects", 
            json={"title": "TEST_PDF_Upload_Test", "description": "Testing PDF upload fix"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Project creation failed: {response.text}"
        self.project_id = response.json()["id"]
        
        yield
        
        # Cleanup - delete test project
        requests.delete(f"{BASE_URL}/api/projects/{self.project_id}", headers=self.headers)

    def create_screenplay_pdf(self) -> bytes:
        """Create a valid screenplay format PDF"""
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        
        # Standard screenplay format
        lines = [
            "                          INT. COFFEE SHOP - DAY",
            "",
            "A busy coffee shop. JOHN, 30s, sits alone at a table.",
            "SARAH, late 20s, enters and spots him.",
            "",
            "                              JOHN",
            "         Hello Sarah, I've been waiting",
            "         for you.",
            "",
            "                              SARAH",
            "         I know, I'm sorry I'm late. The",
            "         traffic was terrible.",
            "",
            "                              JOHN",
            "              (leaning forward)",
            "         That's okay. I have something",
            "         important to tell you.",
            "",
            "                              SARAH",
            "              (concerned)",
            "         What is it? Is everything okay?",
            "",
            "                              JOHN",
            "         Actually, yes. I got the promotion!",
            "",
            "                              SARAH",
            "              (relieved, smiling)",
            "         Oh John, that's wonderful news!",
        ]
        
        for line in lines:
            pdf.cell(0, 10, txt=line, ln=True)
        
        return bytes(pdf.output())

    def create_colon_format_pdf(self) -> bytes:
        """Create a colon-format script PDF (CHARACTER: dialogue)"""
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        
        lines = [
            "JOHN: Hello Sarah, I've been waiting for you.",
            "",
            "SARAH: I know, I'm sorry I'm late.",
            "",
            "JOHN: That's okay. I have something important to tell you.",
            "",
            "SARAH: What is it? Is everything okay?",
            "",
            "JOHN: Actually yes, I got the promotion!",
            "",
            "SARAH: Oh John, that's wonderful news!",
        ]
        
        for line in lines:
            pdf.cell(0, 10, txt=line, ln=True)
        
        return bytes(pdf.output())

    def create_no_dialogue_pdf(self) -> bytes:
        """Create a PDF with no recognizable dialogue format"""
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        
        lines = [
            "This is a test document with no dialogue format.",
            "It contains just regular text paragraphs.",
            "There are no character names or script formatting here.",
            "The parser should not find any dialogue in this file.",
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
        ]
        
        for line in lines:
            pdf.cell(0, 10, txt=line, ln=True)
        
        return bytes(pdf.output())

    def test_upload_screenplay_format_pdf(self):
        """Test uploading a standard screenplay format PDF - should detect characters and lines"""
        pdf_content = self.create_screenplay_pdf()
        
        files = {"file": ("screenplay_test.pdf", pdf_content, "application/pdf")}
        response = requests.post(
            f"{BASE_URL}/api/projects/{self.project_id}/upload-pdf",
            files=files,
            headers=self.headers,
            timeout=120
        )
        
        assert response.status_code == 200, f"PDF upload failed: {response.text}"
        
        data = response.json()
        
        # Verify characters were detected
        assert len(data["characters"]) >= 2, f"Expected at least 2 characters, got {len(data['characters'])}"
        character_names = [c.lower() for c in data["characters"]]
        assert "john" in character_names, "John character not detected"
        assert "sarah" in character_names, "Sarah character not detected"
        
        # Verify lines were parsed
        total_lines = sum(len(s["lines"]) for s in data["scenes"])
        assert total_lines >= 4, f"Expected at least 4 lines, got {total_lines}"
        
        print(f"SUCCESS: Detected {len(data['characters'])} characters: {data['characters']}")
        print(f"SUCCESS: Detected {total_lines} dialogue lines")

    def test_upload_colon_format_pdf(self):
        """Test uploading a colon format PDF (CHARACTER: dialogue)"""
        pdf_content = self.create_colon_format_pdf()
        
        files = {"file": ("colon_format_test.pdf", pdf_content, "application/pdf")}
        response = requests.post(
            f"{BASE_URL}/api/projects/{self.project_id}/upload-pdf",
            files=files,
            headers=self.headers,
            timeout=120
        )
        
        assert response.status_code == 200, f"PDF upload failed: {response.text}"
        
        data = response.json()
        
        # Verify characters were detected
        assert len(data["characters"]) >= 2, f"Expected at least 2 characters, got {len(data['characters'])}"
        
        # Verify lines were parsed
        total_lines = sum(len(s["lines"]) for s in data["scenes"])
        assert total_lines >= 4, f"Expected at least 4 lines, got {total_lines}"
        
        print(f"SUCCESS: Colon format - Detected {len(data['characters'])} characters: {data['characters']}")
        print(f"SUCCESS: Colon format - Detected {total_lines} dialogue lines")

    def test_upload_no_dialogue_pdf_returns_error(self):
        """Test uploading PDF with no dialogue format - should return proper error"""
        pdf_content = self.create_no_dialogue_pdf()
        
        files = {"file": ("no_dialogue.pdf", pdf_content, "application/pdf")}
        response = requests.post(
            f"{BASE_URL}/api/projects/{self.project_id}/upload-pdf",
            files=files,
            headers=self.headers,
            timeout=120
        )
        
        # Should return 400 with error message, NOT 200 with 0 lines
        assert response.status_code == 400, f"Expected 400 error, got {response.status_code}"
        
        error_detail = response.json().get("detail", "")
        assert "dialogue" in error_detail.lower() or "paste script" in error_detail.lower(), \
            f"Expected error about no dialogue, got: {error_detail}"
        
        print(f"SUCCESS: Proper error returned for no-dialogue PDF: {error_detail[:100]}...")

    def test_upload_non_pdf_rejected(self):
        """Test uploading non-PDF file - should be rejected"""
        fake_content = b"This is not a PDF file, just plain text."
        
        files = {"file": ("test.txt", fake_content, "text/plain")}
        response = requests.post(
            f"{BASE_URL}/api/projects/{self.project_id}/upload-pdf",
            files=files,
            headers=self.headers,
            timeout=30
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"SUCCESS: Non-PDF file correctly rejected")


class TestPasteScript:
    """Test paste script functionality as alternative to PDF upload"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token and create test project"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(f"{BASE_URL}/api/projects", 
            json={"title": "TEST_Paste_Script_Test", "description": "Testing paste script"},
            headers=self.headers
        )
        assert response.status_code == 200
        self.project_id = response.json()["id"]
        
        yield
        
        requests.delete(f"{BASE_URL}/api/projects/{self.project_id}", headers=self.headers)

    def test_paste_colon_format_script(self):
        """Test pasting script in CHARACTER: dialogue format"""
        script_text = """JOHN: Hello Sarah, I've been waiting for you.

SARAH: I know, I'm sorry I'm late. The traffic was terrible.

JOHN: That's okay. I have something important to tell you.

SARAH: What is it? Is everything okay?

JOHN: Actually, yes. I got the promotion!

SARAH: Oh John, that's wonderful news!"""

        response = requests.post(
            f"{BASE_URL}/api/projects/{self.project_id}/paste-script",
            json={"script_text": script_text},
            headers=self.headers,
            timeout=120
        )
        
        assert response.status_code == 200, f"Paste script failed: {response.text}"
        
        data = response.json()
        
        # Verify characters detected
        assert len(data["characters"]) >= 2, f"Expected 2+ characters, got {len(data['characters'])}"
        
        # Verify lines parsed
        total_lines = sum(len(s["lines"]) for s in data["scenes"])
        assert total_lines >= 4, f"Expected 4+ lines, got {total_lines}"
        
        print(f"SUCCESS: Paste script detected {len(data['characters'])} characters, {total_lines} lines")

    def test_paste_screenplay_format_script(self):
        """Test pasting script in standard screenplay format"""
        script_text = """JOHN
Hello Sarah, I've been waiting for you.

SARAH
I know, I'm sorry I'm late. The traffic was terrible.

JOHN
That's okay. I have something important to tell you.

SARAH
What is it? Is everything okay?"""

        response = requests.post(
            f"{BASE_URL}/api/projects/{self.project_id}/paste-script",
            json={"script_text": script_text},
            headers=self.headers,
            timeout=120
        )
        
        assert response.status_code == 200, f"Paste script failed: {response.text}"
        
        data = response.json()
        assert len(data["characters"]) >= 2
        
        print(f"SUCCESS: Screenplay format paste detected {len(data['characters'])} characters")

    def test_paste_empty_script_rejected(self):
        """Test pasting empty script - should be rejected"""
        response = requests.post(
            f"{BASE_URL}/api/projects/{self.project_id}/paste-script",
            json={"script_text": "   "},
            headers=self.headers,
            timeout=30
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"SUCCESS: Empty script correctly rejected")

    def test_paste_no_dialogue_script_rejected(self):
        """Test pasting script with no recognizable dialogue format"""
        script_text = """This is just a regular paragraph of text.
It doesn't contain any character names or dialogue formatting.
The system should not be able to parse this as a script."""

        response = requests.post(
            f"{BASE_URL}/api/projects/{self.project_id}/paste-script",
            json={"script_text": script_text},
            headers=self.headers,
            timeout=30
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"SUCCESS: No-dialogue script correctly rejected")


class TestCharacterSelection:
    """Test character selection after script upload"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup with a project that has script uploaded"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create project
        response = requests.post(f"{BASE_URL}/api/projects", 
            json={"title": "TEST_Character_Selection", "description": "Testing character selection"},
            headers=self.headers
        )
        assert response.status_code == 200
        self.project_id = response.json()["id"]
        
        # Upload script via paste
        script_text = """JOHN: Hello Sarah!
SARAH: Hi John!
JOHN: How are you?
SARAH: I'm great, thanks!"""

        response = requests.post(
            f"{BASE_URL}/api/projects/{self.project_id}/paste-script",
            json={"script_text": script_text},
            headers=self.headers,
            timeout=120
        )
        assert response.status_code == 200
        self.project_data = response.json()
        
        yield
        
        requests.delete(f"{BASE_URL}/api/projects/{self.project_id}", headers=self.headers)

    def test_set_user_character(self):
        """Test selecting user's character after upload"""
        # Get available characters
        characters = self.project_data["characters"]
        assert len(characters) >= 2, "Need at least 2 characters"
        
        # Set user character
        char_to_select = characters[0]
        response = requests.post(
            f"{BASE_URL}/api/projects/{self.project_id}/set-character",
            json={"character": char_to_select},
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Set character failed: {response.text}"
        
        data = response.json()
        assert data["user_character"] == char_to_select, "User character not set correctly"
        
        # Verify lines are marked as user lines
        user_lines = 0
        for scene in data["scenes"]:
            for line in scene["lines"]:
                if line["is_user_line"]:
                    user_lines += 1
                    assert line["character"] == char_to_select, "Wrong character marked as user"
        
        assert user_lines > 0, "No lines marked as user lines"
        
        print(f"SUCCESS: Set user character to {char_to_select}, {user_lines} lines marked as user lines")

    def test_set_invalid_character_rejected(self):
        """Test setting a character that doesn't exist in project"""
        response = requests.post(
            f"{BASE_URL}/api/projects/{self.project_id}/set-character",
            json={"character": "NONEXISTENT_CHARACTER_XYZ"},
            headers=self.headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"SUCCESS: Invalid character correctly rejected")


class TestProjectFlow:
    """Test complete project creation and script upload flow"""
    
    def test_complete_project_creation_flow(self):
        """Test full flow: Login -> Create Project -> Upload Script -> Select Character"""
        # 1. Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, "Login failed"
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Create project
        response = requests.post(f"{BASE_URL}/api/projects", 
            json={"title": "TEST_Full_Flow_Test", "description": "Complete flow test"},
            headers=headers
        )
        assert response.status_code == 200, "Project creation failed"
        project_id = response.json()["id"]
        
        try:
            # 3. Upload script via paste (more reliable than PDF)
            script_text = """ALICE: Welcome to the audition!
BOB: Thank you for having me.
ALICE: Please start whenever you're ready.
BOB: Okay, here goes nothing..."""

            response = requests.post(
                f"{BASE_URL}/api/projects/{project_id}/paste-script",
                json={"script_text": script_text},
                headers=headers,
                timeout=120
            )
            assert response.status_code == 200, f"Script upload failed: {response.text}"
            
            data = response.json()
            assert len(data["characters"]) >= 2, "Characters not detected"
            
            total_lines = sum(len(s["lines"]) for s in data["scenes"])
            assert total_lines >= 4, f"Not enough lines detected: {total_lines}"
            
            # 4. Select character
            response = requests.post(
                f"{BASE_URL}/api/projects/{project_id}/set-character",
                json={"character": data["characters"][0]},
                headers=headers
            )
            assert response.status_code == 200, "Character selection failed"
            
            # 5. Verify reader data is available
            response = requests.get(
                f"{BASE_URL}/api/projects/{project_id}/reader-data",
                headers=headers
            )
            assert response.status_code == 200, "Reader data fetch failed"
            
            reader_data = response.json()
            assert reader_data["user_character"] is not None, "User character not set in reader data"
            assert len(reader_data["scenes"]) > 0, "No scenes in reader data"
            
            print("SUCCESS: Complete project flow works correctly!")
            print(f"  - Characters: {reader_data['characters']}")
            print(f"  - User playing: {reader_data['user_character']}")
            print(f"  - Total scenes: {len(reader_data['scenes'])}")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/projects/{project_id}", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
