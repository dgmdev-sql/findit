pipeline {
    agent any

    triggers {
        pollSCM('H/2 * * * *')
    }

    environment {
        TAG = "${env.BUILD_NUMBER}"
        COMPOSE_PROJECT_NAME = 'findit'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git rev-parse --short HEAD'
            }
        }

        stage('Test') {
            steps {
                sh 'docker build --target test -t findit/items-api:test-${TAG} ./items-api'
                sh 'docker build --target test -t findit/claims-api:test-${TAG} ./claims-api'
            }
        }

        stage('Build Images') {
            steps {
                sh 'TAG=${TAG} docker compose -p ${COMPOSE_PROJECT_NAME} build --build-arg BUILD_NUMBER=${TAG}'
            }
        }

        stage('Deploy') {
            steps {
                script {
                    try {
                        withCredentials([file(credentialsId: 'findit-env', variable: 'ENV_FILE')]) {
                            sh 'cp "$ENV_FILE" .env'
                        }
                    } catch (Exception ignored) {
                        sh 'cp .env.example .env'
                    }
                }
                sh 'TAG=${TAG} docker compose -p ${COMPOSE_PROJECT_NAME} up -d --no-build'
            }
        }

        stage('Smoke Test') {
            steps {
                sh '''
                    for i in 1 2 3 4 5 6; do
                        if docker exec findit-proxy-1 wget -q -O - http://127.0.0.1:80/api/items/health | grep -q '"healthy"' && \
                           docker exec findit-proxy-1 wget -q -O - http://127.0.0.1:80/api/claims/health | grep -q '"healthy"' && \
                           docker exec findit-proxy-1 wget -q -O - http://127.0.0.1:80/ | grep -q "Build #${TAG}"; then
                            echo "Smoke test passed for Build #${TAG}"
                            exit 0
                        fi
                        sleep 3
                    done
                    echo "Smoke test failed for Build #${TAG}"
                    exit 1
                '''
            }
        }
    }

    post {
        always {
            sh 'rm -f .env'
        }
        success {
            echo "FindIt Build #${env.BUILD_NUMBER} deployed and verified."
        }
        failure {
            echo "FindIt Build #${env.BUILD_NUMBER} failed. Previous deployment remains active."
        }
    }
}
