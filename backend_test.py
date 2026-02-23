#!/usr/bin/env python3
import requests
import sys
import json
from datetime import datetime
import uuid

class CuePartnerAPITester:
    def __init__(self, base_url="https://actor-teleprompter.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.demo_user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if endpoint else self.base_url
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
            
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                if files:
                    # Remove content-type for file uploads to let requests set it
                    test_headers.pop('Content-Type', None)
                    response = requests.post(url, data=data, files=files, headers=test_headers)
                else:
                    response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"   ✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   📄 Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Non-dict response'}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"   ❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   📄 Error: {error_data}")
                except:
                    print(f"   📄 Raw response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"   ❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_checks(self):
        """Test basic health endpoints"""
        print("\n🏥 TESTING HEALTH ENDPOINTS")
        
        self.run_test("Root endpoint", "GET", "", 200)
        
        # Test health check with specific AI configuration verification
        success, health_data = self.run_test("Health check", "GET", "health", 200)
        if success:
            ai_configured = health_data.get('ai_configured', False)
            elevenlabs_configured = health_data.get('elevenlabs_configured', False)
            
            print(f"   🤖 AI Configured: {ai_configured}")
            print(f"   🔊 ElevenLabs Configured: {elevenlabs_configured}")
            
            if ai_configured and elevenlabs_configured:
                print("   ✅ Both AI and ElevenLabs are properly configured!")
            else:
                print("   ❌ Missing configuration - AI or ElevenLabs not configured")
                if not ai_configured:
                    print("       - AI (GPT-5.2) not configured")
                if not elevenlabs_configured:
                    print("       - ElevenLabs TTS not configured")

    def test_demo_login(self):
        """Test demo user login"""
        print("\n🔐 TESTING DEMO LOGIN")
        
        success, response = self.run_test(
            "Demo user login",
            "POST",
            "auth/login",
            200,
            data={"email": "actor@demo.com", "password": "actor123"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            if 'user' in response:
                self.demo_user_id = response['user'].get('id')
            print(f"   🎫 Token acquired")
            return True
        else:
            print("   ❌ Demo login failed - this will break subsequent tests")
            return False

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 TESTING AUTH ENDPOINTS")
        
        # Test user registration
        test_user_email = f"test_user_{datetime.now().strftime('%H%M%S')}@example.com"
        success, response = self.run_test(
            "User registration",
            "POST",
            "auth/register",
            200,
            data={
                "name": "Test User",
                "email": test_user_email,
                "password": "TestPass123!"
            }
        )
        
        if success and 'access_token' in response:
            test_token = response['access_token']
            
            # Test /auth/me with new user token
            self.run_test(
                "Get current user",
                "GET",
                "auth/me",
                200,
                headers={'Authorization': f'Bearer {test_token}'}
            )

        # Test invalid login
        self.run_test(
            "Invalid login",
            "POST",
            "auth/login",
            401,
            data={"email": "wrong@example.com", "password": "wrongpass"}
        )

        # Test duplicate registration
        self.run_test(
            "Duplicate registration",
            "POST",
            "auth/register",
            400,
            data={
                "name": "Another User",
                "email": test_user_email,
                "password": "AnotherPass123!"
            }
        )

    def test_project_endpoints(self):
        """Test project CRUD operations"""
        print("\n📁 TESTING PROJECT ENDPOINTS")
        
        if not self.token:
            print("   ❌ No auth token - skipping project tests")
            return
        
        # Test get projects (should be empty initially for demo user)
        success, projects = self.run_test(
            "Get projects",
            "GET", 
            "projects",
            200
        )
        
        # Test create project
        project_data = {
            "title": f"Test Project {datetime.now().strftime('%H:%M:%S')}",
            "description": "A test project for API testing"
        }
        
        success, project = self.run_test(
            "Create project",
            "POST",
            "projects", 
            200,
            data=project_data
        )
        
        project_id = None
        if success and 'id' in project:
            project_id = project['id']
            print(f"   📋 Created project: {project_id}")
            
            # Test get specific project
            self.run_test(
                "Get project by ID",
                "GET",
                f"projects/{project_id}",
                200
            )
            
            # Test update project
            self.run_test(
                "Update project",
                "PUT",
                f"projects/{project_id}",
                200,
                data={"title": "Updated Test Project"}
            )
            
            # Test project endpoints that need a project
            self.test_project_features(project_id)
            
            # Test delete project
            self.run_test(
                "Delete project",
                "DELETE",
                f"projects/{project_id}",
                200
            )
        
        # Test non-existent project
        fake_id = str(uuid.uuid4())
        self.run_test(
            "Get non-existent project",
            "GET",
            f"projects/{fake_id}",
            404
        )

    def test_project_features(self, project_id):
        """Test project-specific features like PDF upload"""
        print(f"\n📄 TESTING PROJECT FEATURES for {project_id}")
        
        # Create a simple test "PDF" (just text file for testing)
        test_content = """
        HAMLET
        
        HAMLET
        To be or not to be, that is the question.
        
        OPHELIA
        My lord, how is it with you?
        
        HAMLET
        Well, well, well.
        """
        
        # Test PDF upload - this will likely fail without actual PDF
        files = {'file': ('test_script.txt', test_content, 'text/plain')}
        self.run_test(
            "Upload script (text file - should fail)",
            "POST",
            f"projects/{project_id}/upload-pdf",
            400,  # Should fail because it's not a PDF
            files=files
        )
        
        # Test character setting (should fail because no characters exist)
        self.run_test(
            "Set user character (no characters)",
            "POST",
            f"projects/{project_id}/set-character",
            400,
            data={"character": "HAMLET"}
        )
        
        # Test reader data
        self.run_test(
            "Get reader data",
            "GET",
            f"projects/{project_id}/reader-data",
            200
        )

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting CuePartner API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 50)
        
        self.test_health_checks()
        
        # Demo login is critical for other tests
        demo_login_success = self.test_demo_login()
        
        self.test_auth_endpoints()
        
        if demo_login_success:
            self.test_project_endpoints()
        else:
            print("\n❌ Skipping project tests due to demo login failure")
        
        # Print final results
        print("\n" + "=" * 50)
        print(f"📊 FINAL RESULTS")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = CuePartnerAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())