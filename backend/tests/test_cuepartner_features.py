"""
CuePartner Backend API Tests
Tests for:
- AI Voice Generation - POST /api/projects/{id}/generate-all-audio
- Video Download - GET /api/projects/{id}/takes (returns takes with video_url)
- Direct Submission - POST /api/projects/{id}/takes/{take_id}/submit
- Share Link - GET /api/shared/{token}
- Email Status - GET /api/email/status
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "actor@demo.com"
TEST_PASSWORD = "actor123"
PROJECT_ID = "e2aedaa7-dd93-439c-bc8c-2f7b99c76adc"
VERIFIED_EMAIL = "alerecaresolutions@gmail.com"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token for test user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if response.status_code == 200:
        return response.json().get("access_token")
    
    # User might not exist, try to register
    response = api_client.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "name": "Test Actor"
    })
    
    if response.status_code == 200:
        return response.json().get("access_token")
    
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestHealthAndEmailStatus:
    """Health check and email configuration tests"""
    
    def test_health_check(self, api_client):
        """Test API health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "elevenlabs_configured" in data
        assert "email_configured" in data
        print(f"Health check passed - ElevenLabs: {data['elevenlabs_configured']}, Email: {data['email_configured']}")
    
    def test_email_status(self, api_client):
        """Test GET /api/email/status - should show configured: true"""
        response = api_client.get(f"{BASE_URL}/api/email/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "configured" in data
        assert data["configured"] == True, f"Email should be configured. Got: {data}"
        
        if data["configured"]:
            assert "sender_email" in data
            assert data["sender_email"] is not None
            print(f"Email status: configured=True, sender={data['sender_email']}")


class TestProjectAndTakes:
    """Tests for project access and takes with video download"""
    
    def test_get_project(self, authenticated_client):
        """Test accessing the test project"""
        response = authenticated_client.get(f"{BASE_URL}/api/projects/{PROJECT_ID}")
        
        # Project might not exist - check status
        if response.status_code == 404:
            pytest.skip(f"Project {PROJECT_ID} not found - needs to be created first")
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["id"] == PROJECT_ID
        print(f"Project found: {data.get('title', 'Unknown')}")
    
    def test_get_takes_returns_video_url(self, authenticated_client):
        """Test GET /api/projects/{id}/takes - should return takes with video_url"""
        response = authenticated_client.get(f"{BASE_URL}/api/projects/{PROJECT_ID}/takes")
        
        # Skip if project doesn't exist
        if response.status_code == 404:
            pytest.skip("Project not found")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list)
        
        if len(data) > 0:
            # Check structure of first take
            take = data[0]
            assert "id" in take
            assert "video_url" in take
            assert "take_number" in take
            assert "duration" in take
            
            # Verify video_url is present and can be downloaded
            video_url = take.get("video_url")
            assert video_url is not None
            assert video_url.startswith("data:video/") or video_url.startswith("http")
            print(f"Found {len(data)} takes, first take has video_url: {video_url[:50]}...")
        else:
            print("No takes found - will create one for testing")
    
    def test_create_and_get_take(self, authenticated_client):
        """Test creating a take and verifying video_url is downloadable"""
        # Create a minimal test take with base64 video data
        import base64
        
        # Minimal WebM video header (just for testing - not a valid video)
        test_video_b64 = base64.b64encode(b"WEBM_TEST_DATA_PLACEHOLDER").decode()
        
        create_response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{PROJECT_ID}/takes",
            json={
                "project_id": PROJECT_ID,
                "video_data": f"data:video/webm;base64,{test_video_b64}",
                "duration": 10,
                "notes": "TEST_take_for_api_testing"
            }
        )
        
        if create_response.status_code == 404:
            pytest.skip("Project not found")
        
        assert create_response.status_code == 200, f"Expected 200, got {create_response.status_code}: {create_response.text}"
        
        take_data = create_response.json()
        assert "id" in take_data
        assert "video_url" in take_data
        assert take_data["video_url"].startswith("data:video/")
        
        take_id = take_data["id"]
        print(f"Created test take: {take_id}, take_number: {take_data['take_number']}")
        
        # Verify we can GET the take
        get_response = authenticated_client.get(
            f"{BASE_URL}/api/projects/{PROJECT_ID}/takes/{take_id}"
        )
        assert get_response.status_code == 200
        
        fetched_take = get_response.json()
        assert fetched_take["video_url"] == take_data["video_url"]
        print("Take fetch verified with video_url intact")
        
        # Return take_id for cleanup
        return take_id


class TestAIVoiceGeneration:
    """Tests for AI voice generation endpoint"""
    
    def test_generate_all_audio_project_exists(self, authenticated_client):
        """Test POST /api/projects/{id}/generate-all-audio endpoint existence"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{PROJECT_ID}/generate-all-audio"
        )
        
        # 404 = project not found, 503 = ElevenLabs not configured
        # 200 = success, any other is unexpected
        if response.status_code == 404:
            pytest.skip("Project not found - create project with script first")
        
        if response.status_code == 503:
            print("ElevenLabs not configured - endpoint exists but service unavailable")
            # Endpoint exists, just service not available
            assert True
            return
        
        # Should return success or some response
        assert response.status_code in [200, 201, 400, 422], \
            f"Unexpected status {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Generate all audio response: {data}")
        
        # Check response structure
        if response.status_code == 200:
            assert "generated_count" in data or "message" in data


class TestDirectSubmissionAndSharing:
    """Tests for direct submission and share link features"""
    
    @pytest.fixture(scope="class")
    def test_take_id(self, authenticated_client):
        """Create a test take for sharing tests"""
        import base64
        
        test_video_b64 = base64.b64encode(b"TEST_VIDEO_FOR_SHARING").decode()
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{PROJECT_ID}/takes",
            json={
                "project_id": PROJECT_ID,
                "video_data": f"data:video/webm;base64,{test_video_b64}",
                "duration": 5,
                "notes": "TEST_share_test_take"
            }
        )
        
        if response.status_code == 404:
            pytest.skip("Project not found")
        
        if response.status_code == 200:
            return response.json()["id"]
        
        pytest.skip(f"Failed to create test take: {response.text}")
    
    def test_create_share_link(self, authenticated_client, test_take_id):
        """Test creating a share link for a take"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{PROJECT_ID}/takes/{test_take_id}/share",
            json={
                "take_id": test_take_id,
                "recipient_email": "test@example.com",
                "recipient_name": "Test Recipient",
                "message": "Test share message",
                "expires_hours": 72
            }
        )
        
        assert response.status_code == 200, f"Share link creation failed: {response.text}"
        
        data = response.json()
        assert "share_token" in data
        assert "share_url" in data
        assert data["share_url"].startswith("http")
        
        print(f"Share link created: {data['share_url']}")
        return data["share_token"]
    
    def test_access_shared_take(self, api_client, authenticated_client, test_take_id):
        """Test GET /api/shared/{token} - accessing shared take"""
        # First create share link
        share_response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{PROJECT_ID}/takes/{test_take_id}/share",
            json={
                "take_id": test_take_id,
                "recipient_email": "viewer@example.com",
                "recipient_name": "Viewer",
                "expires_hours": 72
            }
        )
        
        assert share_response.status_code == 200
        share_token = share_response.json()["share_token"]
        
        # Now access the shared take (no auth required)
        shared_response = api_client.get(f"{BASE_URL}/api/shared/{share_token}")
        
        assert shared_response.status_code == 200, f"Shared access failed: {shared_response.text}"
        
        data = shared_response.json()
        assert "take" in data
        assert "project_title" in data
        
        take_data = data["take"]
        assert "video_url" in take_data
        assert "take_number" in take_data
        
        print(f"Shared take accessed: project='{data['project_title']}', views={data.get('views', 'N/A')}")
    
    def test_direct_submission_with_email(self, authenticated_client, test_take_id):
        """Test POST /api/projects/{id}/takes/{take_id}/submit - direct submission with email"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{PROJECT_ID}/takes/{test_take_id}/submit",
            json={
                "recipient_email": VERIFIED_EMAIL,  # Use verified email for Resend test mode
                "recipient_name": "Casting Director Test",
                "message": "This is a test self-tape submission from automated testing."
            }
        )
        
        assert response.status_code == 200, f"Direct submission failed: {response.text}"
        
        data = response.json()
        assert "status" in data
        assert data["status"] == "success"
        assert "share_url" in data
        assert "email_sent" in data
        
        # In test mode with verified email, email should be sent
        print(f"Direct submission: status={data['status']}, email_sent={data['email_sent']}, url={data['share_url']}")
        
        if data["email_sent"]:
            print("SUCCESS: Email was sent via Resend!")
        else:
            print("NOTE: Email not sent (Resend test mode - only sends to verified emails)")
    
    def test_direct_submission_invalid_email_format(self, authenticated_client, test_take_id):
        """Test direct submission with invalid email format"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/projects/{PROJECT_ID}/takes/{test_take_id}/submit",
            json={
                "recipient_email": "invalid-email",
                "recipient_name": "Test",
                "message": ""
            }
        )
        
        # Should return 422 validation error
        assert response.status_code == 422, f"Expected 422 for invalid email, got {response.status_code}"
        print("Validation correctly rejects invalid email format")


class TestShareLinkExpiration:
    """Test share link expiration functionality"""
    
    def test_invalid_share_token(self, api_client):
        """Test accessing non-existent share token returns 404"""
        fake_token = "nonexistent12345"
        response = api_client.get(f"{BASE_URL}/api/shared/{fake_token}")
        
        assert response.status_code == 404
        print("Invalid share token correctly returns 404")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_takes(self, authenticated_client):
        """Delete test takes created during testing"""
        response = authenticated_client.get(f"{BASE_URL}/api/projects/{PROJECT_ID}/takes")
        
        if response.status_code != 200:
            return
        
        takes = response.json()
        deleted_count = 0
        
        for take in takes:
            if take.get("notes", "").startswith("TEST_"):
                delete_response = authenticated_client.delete(
                    f"{BASE_URL}/api/projects/{PROJECT_ID}/takes/{take['id']}"
                )
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"Cleanup: Deleted {deleted_count} test takes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
