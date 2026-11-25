FROM python:3.13.7-slim

WORKDIR /Spam_classifier

COPY requirement.txt .
RUN pip install --no-cache-dir -r requirement.txt \
    && python -m nltk.downloader -d /usr/local/share/nltk_data punkt punkt_tab stopwords

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn bacend:app --host 0.0.0.0 --port ${PORT:-8000}"]