# backend/app.py - Main Flask application (Multi-Election Version)
from flask import Flask, jsonify, request, send_from_directory, session, redirect, url_for, Response, send_file
from flask_cors import CORS
from datetime import datetime, timezone
import json
import io
import csv
import os
import uuid
from config import config
from utils.data_handler import (
    get_candidates, get_votes, save_votes, get_election_status, save_election_status,
    add_candidate, remove_candidate, load_translations,
    get_elections, save_elections, get_election_by_id, create_election_data_structure
)
from models import Candidate, Vote, VotesData, ElectionStatus, Election
from utils.auth import GoogleAuth, VoterSession

def create_app(config_name='default'):
    app = Flask(__name__, static_folder='../frontend')
    app.config.from_object(config[config_name])
    CORS(app, supports_credentials=True)
    app.secret_key = app.config['SECRET_KEY']
    google_auth = GoogleAuth(
        client_id=app.config['GOOGLE_CLIENT_ID'],
        client_secret=app.config['GOOGLE_CLIENT_SECRET'],
        redirect_uri=app.config['GOOGLE_REDIRECT_URI']
    )
    voter_session = VoterSession()

    def _get_election_context(election_id: str, voter_session_id: str):
        if not voter_session_id:
            return None, False, False, (jsonify({'authenticated': False}), 401)
        voter_info = voter_session.get_session(voter_session_id)
        if not voter_info:
            return None, False, False, (jsonify({'authenticated': False}), 401)

        election = get_election_by_id(election_id)
        if not election:
            return None, False, False, (jsonify({'message': 'Election not found'}), 404)

        user_id = voter_info.get('user_id')
        user_email = voter_info.get('email')
        is_eligible_voter = election.is_user_eligible_voter(user_email)
        is_admin = election.is_user_admin(user_id)

        return election, is_admin, is_eligible_voter, None

    @app.route('/')
    def serve_index():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/api/language')
    def get_language():
        return jsonify({'language': 'en'})

    @app.route('/auth/google/login')
    def google_login():
        auth_url, state = google_auth.get_authorization_url()
        session['oauth_state'] = state
        return redirect(auth_url)

    @app.route('/auth/google/callback')
    def google_callback():
        state = request.args.get('state')
        if not state or state != session.get('oauth_state'):
             app.logger.warning("CSRF warning: state mismatch or missing.")
             return jsonify({'message': 'Invalid state parameter'}), 400
        code = request.args.get('code')
        if not code:
            return jsonify({'message': 'Authorization code not found'}), 400
        tokens = google_auth.exchange_code_for_tokens(code)
        if not tokens:
            return jsonify({'message': 'Failed to exchange authorization code'}), 400
        user_info = google_auth.verify_id_token(tokens['id_token'])
        if not user_info:
            return jsonify({'message': 'Failed to verify user identity'}), 400

        session_id = voter_session.create_session(
            user_info['user_id'],
            user_info['email'],
            user_info['name'],
            has_voted=False,
            is_admin=False,
            is_eligible_voter=True
        )
        voter_session.log_login(
            google_user_id=user_info['user_id'],
            email=user_info['email'],
            name=user_info.get('name', '')
        )
        session['voter_session_id'] = session_id
        session['user_info'] = user_info
        return redirect(f"{app.config['FRONTEND_URL']}?authenticated=true")

    @app.route('/api/auth/session')
    def get_session():
        voter_session_id = session.get('voter_session_id')
        if not voter_session_id:
            return jsonify({'authenticated': False}), 401
        voter_info = voter_session.get_session(voter_session_id)
        if not voter_info:
            return jsonify({'authenticated': False}), 401
        return jsonify({
            'authenticated': True,
            'user': {
                'name': voter_info['name'],
                'email': voter_info['email'],
                'isAdmin': voter_info.get('is_admin', False),
                'isEligibleVoter': voter_info.get('is_eligible_voter', True),
                'hasVoted': voter_info.get('has_voted', False)
            }
        }), 200

    @app.route('/api/auth/demo', methods=['POST'])
    def demo_auth():
        demo_user_id = str(uuid.uuid4())
        demo_email = f"demo_user_{demo_user_id[:8]}@example.com"
        demo_name = "Demo User"

        demo_election_id = str(uuid.uuid4())
        demo_election_name = "Demo Election"
        demo_election_description = "A test election for demonstration purposes."

        if not create_election_data_structure(demo_election_id):
            app.logger.error(f"Failed to create data structure for demo election {demo_election_id}")

        demo_election = Election(
            id=demo_election_id,
            name=demo_election_name,
            description=demo_election_description,
            created_by=demo_user_id,
            created_at=datetime.utcnow().isoformat() + 'Z',
            is_open=True,
            start_time=None,
            end_time=None,
            eligible_voter_emails=[demo_email],
            admin_user_ids=[demo_user_id]
        )

        elections = get_elections()
        elections.append(demo_election)
        if not save_elections(elections):
            app.logger.error(f"Failed to save demo election {demo_election_id} to global list")

        session_id = voter_session.create_session(
            demo_user_id,
            demo_email,
            demo_name,
            has_voted=False,
            is_admin=True,
            is_eligible_voter=True
        )
        session['voter_session_id'] = session_id
        session['user_info'] = {'user_id': demo_user_id, 'email': demo_email, 'name': demo_name}
        session['demo_mode'] = True
        session['demo_election_id'] = demo_election_id

        return jsonify({
            'authenticated': True,
            'user': {
                'name': demo_name,
                'email': demo_email,
                'isAdmin': True,
                'isEligibleVoter': True,
                'hasVoted': False
            },
            'demo_election_id': demo_election_id
        }), 200

    @app.route('/api/auth/logout', methods=['POST'])
    def logout():
        voter_session_id = session.get('voter_session_id')
        if voter_session_id:
            voter_session.delete_session(voter_session_id)
        session.pop('voter_session_id', None)
        session.pop('user_info', None)
        session.pop('demo_mode', None)
        session.pop('demo_election_id', None)
        return jsonify({'message': 'Logged out successfully'}), 200

    @app.route('/api/elections', methods=['POST'])
    def create_election():
        voter_session_id = session.get('voter_session_id')
        if not voter_session_id:
            return jsonify({'authenticated': False}), 401
        voter_info = voter_session.get_session(voter_session_id)
        if not voter_info:
            return jsonify({'authenticated': False}), 401

        data = request.get_json()
        if not data:
            return jsonify({'message': 'Invalid JSON data'}), 400

        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        creator_user_id = voter_info.get('user_id')
        creator_email = voter_info.get('email')

        if not name or not creator_user_id:
             return jsonify({'message': 'Election name and authenticated user are required'}), 400

        new_election_id = str(uuid.uuid4())
        new_election = Election(
            id=new_election_id,
            name=name,
            description=description,
            created_by=creator_user_id,
            created_at=datetime.utcnow().isoformat() + 'Z',
            is_open=False,
            start_time=None,
            end_time=None,
            eligible_voter_emails=[creator_email],
            admin_user_ids=[creator_user_id]
        )

        if not create_election_data_structure(new_election_id):
            return jsonify({'message': 'Failed to create data structure for new election'}), 500

        elections = get_elections()
        elections.append(new_election)
        if save_elections(elections):
            return jsonify({'message': 'Election created successfully', 'election_id': new_election_id}), 201
        else:
            return jsonify({'message': 'Failed to save new election'}), 500

    @app.route('/api/elections', methods=['GET'])
    def list_elections():
        voter_session_id = session.get('voter_session_id')
        if not voter_session_id:
            return jsonify({'authenticated': False}), 401
        voter_info = voter_session.get_session(voter_session_id)
        if not voter_info:
            return jsonify({'authenticated': False}), 401

        user_id = voter_info.get('user_id')
        user_email = voter_info.get('email')

        all_elections = get_elections()
        accessible_elections = []

        for election in all_elections:
            if election.is_user_admin(user_id) or election.is_user_eligible_voter(user_email):
                 accessible_elections.append({
                     'id': election.id,
                     'name': election.name,
                     'description': election.description,
                     'created_at': election.created_at,
                     'is_admin': election.is_user_admin(user_id)
                 })

        return jsonify(accessible_elections), 200

    @app.route('/api/elections/<election_id>', methods=['GET'])
    def get_election_details(election_id):
        voter_session_id = session.get('voter_session_id')
        election, is_admin, is_eligible_voter, error_response = _get_election_context(election_id, voter_session_id)
        if error_response:
            return error_response

        if not (is_admin or is_eligible_voter):
             return jsonify({'message': 'Access denied to this election'}), 403

        return jsonify(election.to_dict()), 200

    @app.route('/api/elections/<election_id>', methods=['PUT'])
    def update_election(election_id):
        voter_session_id = session.get('voter_session_id')
        election, is_admin, _, error_response = _get_election_context(election_id, voter_session_id)
        if error_response:
            return error_response

        if not is_admin:
             return jsonify({'message': 'Admin access required to update election'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'message': 'Invalid JSON data'}), 400

        try:
            election.name = data.get('name', election.name)
            election.description = data.get('description', election.description)
            if 'eligible_voter_emails' in data:
                election.eligible_voter_emails = data['eligible_voter_emails']
            if 'admin_user_ids' in data:
                 election.admin_user_ids = data['admin_user_ids']

            elections = get_elections()
            for i, e in enumerate(elections):
                if e.id == election_id:
                    elections[i] = election
                    break
            if save_elections(elections):
                return jsonify({'message': 'Election updated successfully'}), 200
            else:
                 return jsonify({'message': 'Failed to save updated election'}), 500
        except Exception as e:
             app.logger.error(f"Error updating election {election_id}: {e}")
             return jsonify({'message': 'Failed to update election'}), 500

    @app.route('/api/elections/<election_id>', methods=['DELETE'])
    def delete_election(election_id):
         voter_session_id = session.get('voter_session_id')
         election, is_admin, _, error_response = _get_election_context(election_id, voter_session_id)
         if error_response:
             return error_response

         if not is_admin:
             return jsonify({'message': 'Admin access required to delete election'}), 403

         try:
             elections = get_elections()
             elections = [e for e in elections if e.id != election_id]
             if save_elections(elections):
                 return jsonify({'message': 'Election deleted successfully'}), 200
             else:
                 return jsonify({'message': 'Failed to save election list after deletion'}), 500
         except Exception as e:
             app.logger.error(f"Error deleting election {election_id}: {e}")
             return jsonify({'message': 'Failed to delete election'}), 500

    @app.route('/api/elections/<election_id>/candidates')
    def get_candidates_api(election_id):
        voter_session_id = session.get('voter_session_id')
        election, is_admin, is_eligible_voter, error_response = _get_election_context(election_id, voter_session_id)
        if error_response:
            return error_response

        if not (is_eligible_voter or is_admin):
            return jsonify({'message': 'Access denied to candidates for this election'}), 403

        include_private = is_eligible_voter or is_admin
        candidates = get_candidates(election_id, include_private=include_private)
        candidates_dicts = [c.to_dict(include_private=include_private) for c in candidates]
        return jsonify(candidates_dicts), 200

    @app.route('/api/elections/<election_id>/results')
    def get_results(election_id):
        voter_session_id = session.get('voter_session_id')
        election, is_admin, is_eligible_voter, error_response = _get_election_context(election_id, voter_session_id)
        if error_response:
            return error_response

        if not (is_eligible_voter or is_admin):
            user_email = voter_session.get_session(voter_session_id).get('email', 'Unknown')
            app.logger.warning(f"User {user_email} attempted to view results for election {election_id} but is not eligible.")
            return jsonify({'message': 'You are not authorized to view election results for this election.'}), 403

        status = get_election_status(election_id)
        current_time = datetime.now(timezone.utc)
        is_election_open = False
        if status.start_time and status.end_time:
            try:
                start_dt = datetime.fromisoformat(status.start_time.replace('Z', '+00:00')) if isinstance(status.start_time, str) else status.start_time
                end_dt = datetime.fromisoformat(status.end_time.replace('Z', '+00:00')) if isinstance(status.end_time, str) else status.end_time
                is_election_open = start_dt <= current_time < end_dt
            except ValueError as e:
                app.logger.error(f"Error parsing election start/end times for results (Election ID: {election_id}): {e}")

        if is_election_open:
            return jsonify({
                'isOpen': True,
                'message': 'Election is currently open. Results will be available after the election closes.',
                'totalVotes': 0,
                'results': []
            }), 200

        votes_data = get_votes(election_id)
        if not votes_data.votes:
            return jsonify({
                'isOpen': False,
                'totalVotes': 0,
                'results': []
            }), 200

        candidates = get_candidates(election_id, include_private=False)
        candidate_votes = {}
        total_votes = len(votes_data.voter_ids)

        for candidate in candidates:
            candidate_votes[candidate.id] = {'name': candidate.name, 'councilVotes': 0, 'executiveVotes': 0}

        for vote in votes_data.votes:
            for candidate_id in vote.selected_candidates:
                if candidate_id in candidate_votes:
                    candidate_votes[candidate_id]['councilVotes'] += 1
            for candidate_id in vote.executive_candidates:
                if candidate_id in candidate_votes:
                    candidate_votes[candidate_id]['executiveVotes'] += 1

        results = [
            {
                'id': candidate_id,
                'name': vote_data['name'],
                'councilVotes': vote_data['councilVotes'],
                'executiveVotes': vote_data['executiveVotes']
            }
            for candidate_id, vote_data in candidate_votes.items()
        ]
        results.sort(key=lambda x: (-x['councilVotes'], -x['executiveVotes']))

        return jsonify({
            'isOpen': False,
            'totalVotes': total_votes,
            'results': results
        }), 200

    @app.route('/api/elections/<election_id>/election/status')
    def get_election_status_api(election_id):
         voter_session_id = session.get('voter_session_id')
         election, is_admin, is_eligible_voter, error_response = _get_election_context(election_id, voter_session_id)
         if error_response:
             return error_response

         try:
             status = get_election_status(election_id)
             current_time = datetime.now(timezone.utc)
             is_open = False
             if status.start_time and status.end_time:
                 start_dt = datetime.fromisoformat(status.start_time.replace('Z', '+00:00')) if isinstance(status.start_time, str) else status.start_time
                 end_dt = datetime.fromisoformat(status.end_time.replace('Z', '+00:00')) if isinstance(status.end_time, str) else status.end_time
                 is_open = start_dt <= current_time < end_dt
             return jsonify({
                  'is_open': is_open,
                  'start_time': status.start_time,
                  'end_time': status.end_time
              }), 200
         except Exception as e:
             app.logger.error(f"Error fetching election status for election {election_id}: {e}")
             return jsonify({
                  'is_open': False,
                  'start_time': None,
                  'end_time': None,
                 'message': "Error fetching election status."}), 500

    @app.route('/api/elections/<election_id>/votes/submit', methods=['POST'])
    def submit_vote(election_id):
        voter_session_id = session.get('voter_session_id')
        election, is_admin, is_eligible_voter, error_response = _get_election_context(election_id, voter_session_id)
        if error_response:
            return error_response

        if not is_eligible_voter:
             user_email = voter_session.get_session(voter_session_id).get('email', 'Unknown')
             app.logger.warning(f"User {user_email} attempted to vote in election {election_id} but is not eligible.")
             return jsonify({'message': 'You are not authorized to vote in this election.'}), 403

        voter_info = voter_session.get_session(voter_session_id)
        votes_data = get_votes(election_id)
        if voter_info['user_id'] in votes_data.voter_ids:
            return jsonify({'message': 'You have already voted in this election'}), 400

        data = request.get_json()
        selected_candidates = data.get('selectedCandidates', [])
        executive_candidates = data.get('executiveCandidates', [])

        if not isinstance(selected_candidates, list) or not isinstance(executive_candidates, list):
            return jsonify({'message': 'Invalid data format'}), 400
        if len(selected_candidates) != 15 or len(executive_candidates) != 7:
            return jsonify({'message': 'Invalid number of selections'}), 400
        if len(set(selected_candidates)) != len(selected_candidates) or len(set(executive_candidates)) != len(executive_candidates):
            return jsonify({'message': 'Duplicate selections are not allowed'}), 400
        if not set(executive_candidates).issubset(set(selected_candidates)):
            return jsonify({'message': 'All executive candidates must also be selected as council members'}), 400

        election_status = get_election_status(election_id)
        is_election_open = False
        if election_status.start_time and election_status.end_time:
            try:
                start_dt = datetime.fromisoformat(election_status.start_time.replace('Z', '+00:00')) if isinstance(election_status.start_time, str) else election_status.start_time
                end_dt = datetime.fromisoformat(election_status.end_time.replace('Z', '+00:00')) if isinstance(election_status.end_time, str) else election_status.end_time
                current_time = datetime.now(timezone.utc)
                is_election_open = start_dt <= current_time < end_dt
            except ValueError as e:
                app.logger.error(f"Error parsing election start/end times for vote submission (Election ID: {election_id}): {e}")
                is_election_open = False
        else:
            is_election_open = False

        if not is_election_open:
            return jsonify({'message': 'Election is currently closed'}), 400

        new_vote = Vote(id=str(uuid.uuid4()),
                        voter_id=voter_info['user_id'],
                        selected_candidates=selected_candidates,
                        executive_candidates=executive_candidates,
                        voter_name=voter_info['name'],
                        voter_email=voter_info['email'],
                        timestamp=datetime.utcnow().isoformat() + 'Z')

        votes_data.voter_ids.append(voter_info['user_id'])
        votes_data.votes.append(new_vote)
        if save_votes(votes_data, election_id):
            return jsonify({'message': 'Vote submitted successfully'}), 200
        else:
            return jsonify({'message': 'Failed to save vote'}), 500

    @app.route('/api/elections/<election_id>/admin/candidates', methods=['GET'])
    def get_admin_candidates(election_id):
        voter_session_id = session.get('voter_session_id')
        election, is_admin, _, error_response = _get_election_context(election_id, voter_session_id)
        if error_response:
            return error_response

        if not is_admin:
            return jsonify({'message': 'Admin access required'}), 403

        try:
            candidates = get_candidates(election_id, include_private=True)
            return jsonify([c.to_dict(include_private=True) for c in candidates]), 200
        except Exception as e:
            app.logger.error(f"Error fetching admin candidates for election {election_id}: {e}")
            return jsonify({"message": "Internal server error fetching candidates for admin."}), 500

    @app.route('/api/elections/<election_id>/admin/candidates', methods=['POST'])
    def create_candidate(election_id):
        voter_session_id = session.get('voter_session_id')
        election, is_admin, _, error_response = _get_election_context(election_id, voter_session_id)
        if error_response:
            return error_response

        if not is_admin:
            return jsonify({'message': 'Admin access required'}), 403

        try:
            data = request.get_json()
            if not data:
                return jsonify({"message": "Invalid JSON data"}), 400

            required_fields = ['name', 'bio']
            for field in required_fields:
                if not data.get(field):
                     return jsonify({"message": f"Missing required field: {field}"}), 400

            election_status = get_election_status(election_id)
            if election_status.is_open:
                 return jsonify({"message": "Cannot add candidates while election is open."}), 400

            success, message_or_error = add_candidate(data, election_id)
            if success:
                return jsonify({"message": message_or_error}), 201
            else:
                return jsonify({"message": message_or_error}), 400
        except Exception as e:
            app.logger.error(f"Error creating candidate for election {election_id}: {e}")
            return jsonify({"message": "Internal server error creating candidate."}), 500

    @app.route('/api/elections/<election_id>/admin/candidates/<int:candidate_id>', methods=['DELETE'])
    def delete_candidate(election_id, candidate_id):
        voter_session_id = session.get('voter_session_id')
        election, is_admin, _, error_response = _get_election_context(election_id, voter_session_id)
        if error_response:
            return error_response

        if not is_admin:
            return jsonify({'message': 'Admin access required'}), 403

        try:
             election_status = get_election_status(election_id)
             if election_status.is_open:
                 return jsonify({"message": "Cannot remove candidates while election is open."}), 400

             success, message_or_error = remove_candidate(candidate_id, election_id)
             if success:
                 return jsonify({"message": message_or_error}), 200
             else:
                 return jsonify({"message": message_or_error}), 404
        except Exception as e:
            app.logger.error(f"Error deleting candidate {candidate_id} for election {election_id}: {e}")
            return jsonify({"message": "Internal server error deleting candidate."}), 500

    @app.route('/api/elections/<election_id>/admin/election/toggle', methods=['POST'])
    def toggle_election(election_id):
        voter_session_id = session.get('voter_session_id')
        election, is_admin, _, error_response = _get_election_context(election_id, voter_session_id)
        if error_response:
            return error_response

        if not is_admin:
            return jsonify({'message': 'Admin access required'}), 403

        try:
            current_status = get_election_status(election_id)
            new_status = ElectionStatus(is_open=not current_status.is_open)
            if save_election_status(new_status, election_id):
                action = "opened" if new_status.is_open else "closed"
                return jsonify({'message': f'Election successfully {action}', 'is_open': new_status.is_open}), 200
            else:
                return jsonify({'message': 'Failed to update election status'}), 500
        except Exception as e:
            app.logger.error(f"Error toggling election {election_id}: {e}")
            return jsonify({'message': 'An internal server error occurred'}), 500

    @app.route('/api/elections/<election_id>/admin/votes/export', methods=['GET'])
    def export_votes(election_id):
        voter_session_id = session.get('voter_session_id')
        election, is_admin, _, error_response = _get_election_context(election_id, voter_session_id)
        if error_response:
            return error_response

        if not is_admin:
            return jsonify({'message': 'Admin access required'}), 403

        try:
            from utils.data_handler import DATA_DIR
            VOTES_FILE_PATH = os.path.join(DATA_DIR, 'elections', election_id, 'votes.json')
            if not os.path.exists(VOTES_FILE_PATH):
                app.logger.error(f"Votes file not found at expected path for election {election_id}: {VOTES_FILE_PATH}")
                return jsonify({"error": "Votes file not found on server for this election."}), 404
            return send_file(
                VOTES_FILE_PATH,
                as_attachment=True,
                download_name=f'election_{election_id}_votes.json'
            )
        except Exception as e:
            app.logger.error(f"Error exporting votes file for election {election_id}: {e}", exc_info=True)
            return jsonify({"error": "An internal error occurred while exporting votes."}), 500

    @app.route('/api/elections/<election_id>/admin/votes/export/csv', methods=['GET'])
    def export_votes_to_csv(election_id):
        voter_session_id = session.get('voter_session_id')
        election, is_admin, _, error_response = _get_election_context(election_id, voter_session_id)
        if error_response:
            return error_response

        if not is_admin:
            return jsonify({'message': 'Admin access required'}), 403

        try:
            votes_data = get_votes(election_id)
            candidates = get_candidates(election_id, include_private=False)
            candidate_lookup = {c.id: c.name for c in candidates}
            voter_email_lookup = {vote.voter_id: vote.voter_email for vote in votes_data.votes}

            output = io.StringIO()
            writer = csv.writer(output)
            header = ['Voter Name']
            header.extend([f'Executive {i+1}' for i in range(7)])
            header.extend([f'Council {i+1}' for i in range(8)])
            writer.writerow(header)

            for vote in votes_data.votes:
                voter_email = voter_email_lookup.get(vote.voter_id, f"Unknown Email ({vote.voter_id})")
                row = [voter_email]
                executive_names_list = [candidate_lookup.get(cid, f"Unknown ID: {cid}") for cid in vote.executive_candidates[:7]]
                executive_names_list.extend([''] * (7 - len(executive_names_list)))
                row.extend(executive_names_list)
                remaining_council_ids = [cid for cid in vote.selected_candidates if cid not in set(vote.executive_candidates)]
                remaining_council_names_list = [candidate_lookup.get(cid, f"Unknown ID: {cid}") for cid in remaining_council_ids[:8]]
                remaining_council_names_list.extend([''] * (8 - len(remaining_council_names_list)))
                row.extend(remaining_council_names_list)
                writer.writerow(row)

            csv_data = output.getvalue()
            output.close()
            return Response(
                csv_data,
                mimetype='text/csv',
                headers={"Content-Disposition": f"attachment;filename=election_{election_id}_votes_export_with_names.csv"}
            )
        except FileNotFoundError as e:
            app.logger.error(f"Data file not found during CSV export for election {election_id}: {e}")
            return jsonify({'message': 'Required data file not found for export.'}), 404
        except Exception as err:
            app.logger.error(f"Error exporting votes to CSV for election {election_id}: {err}")
            return jsonify({'message': 'An internal server error occurred during CSV export.'}), 500

    @app.route('/api/translations')
    def get_translations():
        translations_data = load_translations()
        if translations_data:
            return jsonify(translations_data), 200
        else:
            return jsonify({}), 200

    @app.route('/api/elections/<election_id>/admin/election/schedule', methods=['POST'])
    def schedule_election(election_id):
        voter_session_id = session.get('voter_session_id')
        election, is_admin, _, error_response = _get_election_context(election_id, voter_session_id)
        if error_response:
            return error_response

        if not is_admin:
            return jsonify({'message': 'Admin access required'}), 403

        try:
            data = request.get_json()
            if data is None:
                app.logger.warning("schedule_election: Invalid or missing JSON in request body.")
                return jsonify({'message': 'Invalid or missing JSON data in request body.'}), 400

            start_time_str = data.get('start_time')
            end_time_str = data.get('end_time')
            if not start_time_str or not end_time_str:
                return jsonify({'message': 'Both start_time and end_time are required.'}), 400

            try:
                start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
                end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
            except ValueError as ve:
                app.logger.warning(f"schedule_election: Invalid datetime format provided: {ve}")
                return jsonify({'message': 'Invalid datetime format. Use ISO 8601 (e.g., 2024-06-15T10:00:00Z).'}), 400

            if start_time >= end_time:
                return jsonify({'message': 'Start time must be before end time.'}), 400

            new_status = ElectionStatus(is_open=False, start_time=start_time, end_time=end_time)
            if save_election_status(new_status, election_id):
                return jsonify({
                    'message': 'Election schedule updated successfully.',
                    'start_time': new_status.start_time.isoformat() if new_status.start_time else None,
                    'end_time': new_status.end_time.isoformat() if new_status.end_time else None
                }), 200
            else:
                app.logger.error("schedule_election: Failed to save election status to data handler.")
                return jsonify({'message': 'Failed to save election schedule.'}), 500
        except Exception as e:
            app.logger.error(f"Error scheduling election {election_id}: {e}", exc_info=True)
            return jsonify({'message': 'An internal server error occurred on the server.'}), 500

    @app.route('/<path:filename>')
    def serve_static(filename):
        return send_from_directory(app.static_folder, filename)

    return app

if __name__ == '__main__':
    app = create_app('development')
    app.run(debug=True, port=5000)
else:
    # For production (PythonAnywhere imports this)
    app = create_app('production')
