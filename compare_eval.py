#!/usr/bin/env python3
"""
Compare leads export against evaluation set and original leads to measure performance.
"""

import csv
import re
from collections import defaultdict
from difflib import SequenceMatcher

def normalize_name(name):
    """Normalize name for matching."""
    if not name:
        return ""
    name = re.sub(r'\s+', ' ', name.strip().lower())
    name = re.sub(r'^(mr|mrs|ms|dr|prof)\.?\s+', '', name)
    return name

def name_similarity(name1, name2):
    """Calculate similarity between two names."""
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)
    if not n1 or not n2:
        return 0.0
    return SequenceMatcher(None, n1, n2).ratio()

def normalize_company(company):
    """Normalize company name for matching."""
    if not company:
        return ""
    company = company.lower().strip()
    company = re.sub(r'\s+(inc|llc|ltd|corp|corporation|company)\.?$', '', company)
    return company

def load_original_leads(filename):
    """Load original leads CSV."""
    leads_data = defaultdict(list)
    
    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            company = row['account_name'].strip()
            first = row['lead_first_name'].strip()
            last = row['lead_last_name'].strip()
            name = f"{first} {last}".strip()
            title = row['lead_job_title'].strip()
            domain = row['account_domain'].strip()
            
            if not company or not name:
                continue
            
            leads_data[company].append({
                'name': name,
                'title': title,
                'domain': domain,
                'employee_range': row.get('account_employee_range', '').strip()
            })
    
    return leads_data

def load_eval_set(filename):
    """Load evaluation set."""
    eval_data = defaultdict(list)
    
    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            company = row['Company'].strip()
            name = row['Full Name'].strip()
            title = row['Title'].strip()
            rank_str = row['Rank'].strip()
            
            if not company or not name:
                continue
            
            rank = None
            if rank_str and rank_str != '-':
                try:
                    rank = int(rank_str)
                except ValueError:
                    pass
            
            eval_data[company].append({
                'name': name,
                'title': title,
                'rank': rank,
                'employee_range': row.get('Employee Range', '').strip()
            })
    
    return eval_data

def load_scored_leads(filename):
    """Load scored leads export."""
    leads_data = defaultdict(list)
    
    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            company = row['Company'].strip()
            name = row['Lead Name'].strip()
            title = row['Title'].strip()
            score_str = row.get('Score', '0').strip()
            relevant = row.get('Relevant?', '').strip()
            
            if not company or not name:
                continue
            
            try:
                score = int(score_str) if score_str else 0
            except ValueError:
                score = 0
            
            leads_data[company].append({
                'name': name,
                'title': title,
                'score': score,
                'relevant': relevant == 'Yes'
            })
    
    return leads_data

def find_best_match(target_name, candidates, threshold=0.7):
    """Find best matching name from candidates."""
    best_match = None
    best_score = 0.0
    
    for candidate in candidates:
        score = name_similarity(target_name, candidate['name'])
        if score > best_score and score >= threshold:
            best_score = score
            best_match = candidate
    
    return best_match, best_score

def compare_input_output(original_data, scored_data):
    """Compare original input with scored output."""
    results = {
        'total_original': 0,
        'total_scored': 0,
        'matched': 0,
        'missing_in_output': [],
        'extra_in_output': [],
        'coverage_by_company': {}
    }
    
    # Check coverage
    for company, original_people in original_data.items():
        results['total_original'] += len(original_people)
        
        # Find matching company in scored data
        scored_people = None
        best_match_score = 0.0
        
        for scored_company, people in scored_data.items():
            score = SequenceMatcher(None, 
                                  normalize_company(company), 
                                  normalize_company(scored_company)).ratio()
            if score > best_match_score:
                best_match_score = score
                scored_people = people
        
        if not scored_people or best_match_score < 0.7:
            results['coverage_by_company'][company] = {
                'original_count': len(original_people),
                'scored_count': 0,
                'coverage': 0.0
            }
            for person in original_people:
                results['missing_in_output'].append({
                    'company': company,
                    'name': person['name']
                })
            continue
        
        results['total_scored'] += len(scored_people)
        
        # Match people
        matched_count = 0
        for original_person in original_people:
            match, similarity = find_best_match(original_person['name'], scored_people)
            if match:
                matched_count += 1
                results['matched'] += 1
            else:
                results['missing_in_output'].append({
                    'company': company,
                    'name': original_person['name']
                })
        
        results['coverage_by_company'][company] = {
            'original_count': len(original_people),
            'scored_count': len(scored_people),
            'matched_count': matched_count,
            'coverage': matched_count / len(original_people) * 100 if original_people else 0.0
        }
    
    # Find extras in output
    for company, scored_people in scored_data.items():
        # Check if this company exists in original
        found = False
        for orig_company in original_data.keys():
            if SequenceMatcher(None, 
                             normalize_company(company), 
                             normalize_company(orig_company)).ratio() > 0.7:
                found = True
                break
        
        if not found:
            for person in scored_people:
                results['extra_in_output'].append({
                    'company': company,
                    'name': person['name']
                })
    
    return results

def analyze_ranking_patterns(eval_data, scored_data):
    """Analyze ranking patterns."""
    results = {
        'eval_stats': {
            'companies': len(eval_data),
            'total_people': 0,
            'ranked_people': 0,
            'rank_distribution': defaultdict(int),
            'people_per_company': []
        },
        'scored_stats': {
            'companies': len(scored_data),
            'total_people': 0,
            'relevant_people': 0,
            'score_distribution': defaultdict(int),
            'people_per_company': [],
            'relevant_by_score': defaultdict(int),
            'avg_score_by_relevance': {'Yes': [], 'No': []}
        },
        'overlap': {
            'eval_companies': set(eval_data.keys()),
            'scored_companies': set(scored_data.keys()),
            'common_companies': set()
        }
    }
    
    # Analyze eval set
    for company, people in eval_data.items():
        results['eval_stats']['total_people'] += len(people)
        results['eval_stats']['people_per_company'].append(len(people))
        for person in people:
            if person['rank'] is not None:
                results['eval_stats']['ranked_people'] += 1
                results['eval_stats']['rank_distribution'][person['rank']] += 1
    
    # Analyze scored leads
    for company, people in scored_data.items():
        results['scored_stats']['total_people'] += len(people)
        results['scored_stats']['people_per_company'].append(len(people))
        for person in people:
            if person['relevant']:
                results['scored_stats']['relevant_people'] += 1
            score_bucket = (person['score'] // 10) * 10
            results['scored_stats']['score_distribution'][score_bucket] += 1
            if person['relevant']:
                results['scored_stats']['relevant_by_score'][score_bucket] += 1
            
            # Track scores by relevance
            if person['relevant']:
                results['scored_stats']['avg_score_by_relevance']['Yes'].append(person['score'])
            else:
                results['scored_stats']['avg_score_by_relevance']['No'].append(person['score'])
    
    # Check company overlap
    eval_normalized = {normalize_company(c): c for c in eval_data.keys()}
    scored_normalized = {normalize_company(c): c for c in scored_data.keys()}
    
    for eval_norm, eval_orig in eval_normalized.items():
        for scored_norm, scored_orig in scored_normalized.items():
            similarity = SequenceMatcher(None, eval_norm, scored_norm).ratio()
            if similarity > 0.8:
                results['overlap']['common_companies'].add((eval_orig, scored_orig))
    
    return results

def print_comprehensive_report(input_output, patterns):
    """Print comprehensive comparison report."""
    print("=" * 80)
    print("COMPREHENSIVE EVALUATION REPORT")
    print("=" * 80)
    print()
    
    # Input vs Output Coverage
    print("1. INPUT vs OUTPUT COVERAGE")
    print("-" * 80)
    print(f"Original Leads (Input):")
    print(f"  Total Companies: {len(input_output['coverage_by_company'])}")
    print(f"  Total People: {input_output['total_original']}")
    print()
    print(f"Scored Leads (Output):")
    print(f"  Total Companies: {len(patterns['scored_stats']['people_per_company'])}")
    print(f"  Total People: {input_output['total_scored']}")
    print()
    print(f"Coverage:")
    print(f"  Matched People: {input_output['matched']} / {input_output['total_original']}")
    print(f"  Coverage Rate: {input_output['matched'] / input_output['total_original'] * 100:.1f}%")
    print(f"  Missing in Output: {len(input_output['missing_in_output'])}")
    print(f"  Extra in Output: {len(input_output['extra_in_output'])}")
    print()
    
    if input_output['coverage_by_company']:
        print("Coverage by Company (showing companies with <100% coverage):")
        incomplete = [(c, d) for c, d in input_output['coverage_by_company'].items() 
                     if d['coverage'] < 100.0]
        if incomplete:
            for company, data in sorted(incomplete, key=lambda x: x[1]['coverage'])[:10]:
                print(f"  {company}: {data['matched_count']}/{data['original_count']} ({data['coverage']:.1f}%)")
        else:
            print("  All companies have 100% coverage!")
        print()
    
    # Evaluation Set Patterns
    print("2. EVALUATION SET PATTERNS")
    print("-" * 80)
    print(f"Evaluation Set:")
    print(f"  Companies: {patterns['eval_stats']['companies']}")
    print(f"  Total People: {patterns['eval_stats']['total_people']}")
    print(f"  Ranked People: {patterns['eval_stats']['ranked_people']}")
    if patterns['eval_stats']['people_per_company']:
        avg = sum(patterns['eval_stats']['people_per_company']) / len(patterns['eval_stats']['people_per_company'])
        print(f"  Avg People per Company: {avg:.1f}")
    print()
    
    if patterns['eval_stats']['rank_distribution']:
        print("Rank Distribution:")
        for rank in sorted(patterns['eval_stats']['rank_distribution'].keys())[:10]:
            count = patterns['eval_stats']['rank_distribution'][rank]
            print(f"  Rank {rank}: {count} people")
        print()
    
    # Scored Leads Patterns
    print("3. SCORED LEADS PATTERNS")
    print("-" * 80)
    print(f"Scored Leads:")
    print(f"  Companies: {patterns['scored_stats']['companies']}")
    print(f"  Total People: {patterns['scored_stats']['total_people']}")
    print(f"  Relevant People: {patterns['scored_stats']['relevant_people']}")
    print(f"  Relevance Rate: {patterns['scored_stats']['relevant_people'] / patterns['scored_stats']['total_people'] * 100:.1f}%")
    if patterns['scored_stats']['people_per_company']:
        avg = sum(patterns['scored_stats']['people_per_company']) / len(patterns['scored_stats']['people_per_company'])
        print(f"  Avg People per Company: {avg:.1f}")
    print()
    
    if patterns['scored_stats']['avg_score_by_relevance']['Yes']:
        avg_relevant = sum(patterns['scored_stats']['avg_score_by_relevance']['Yes']) / len(patterns['scored_stats']['avg_score_by_relevance']['Yes'])
        print(f"Average Score for Relevant: {avg_relevant:.1f}")
    if patterns['scored_stats']['avg_score_by_relevance']['No']:
        avg_not_relevant = sum(patterns['scored_stats']['avg_score_by_relevance']['No']) / len(patterns['scored_stats']['avg_score_by_relevance']['No'])
        print(f"Average Score for Not Relevant: {avg_not_relevant:.1f}")
    print()
    
    print("Score Distribution:")
    for score_bucket in sorted(patterns['scored_stats']['score_distribution'].keys()):
        count = patterns['scored_stats']['score_distribution'][score_bucket]
        relevant_count = patterns['scored_stats']['relevant_by_score'].get(score_bucket, 0)
        pct = relevant_count / count * 100 if count > 0 else 0
        print(f"  {score_bucket}-{score_bucket+9}: {count} people ({relevant_count} relevant, {pct:.1f}%)")
    print()
    
    # Company Overlap
    print("4. COMPANY OVERLAP")
    print("-" * 80)
    print(f"Evaluation Set Companies: {len(patterns['overlap']['eval_companies'])}")
    print(f"Scored Leads Companies: {len(patterns['overlap']['scored_companies'])}")
    print(f"Common Companies: {len(patterns['overlap']['common_companies'])}")
    if patterns['overlap']['common_companies']:
        print("\nCommon Companies:")
        for eval_c, scored_c in sorted(patterns['overlap']['common_companies']):
            print(f"  {eval_c} <-> {scored_c}")
    else:
        print("\n⚠️  No overlapping companies found between eval set and scored leads.")
        print("   This means you're evaluating different companies, so direct comparison")
        print("   of rankings isn't possible. However, you can compare methodology patterns.")
    print()

def main():
    print("Loading data files...")
    original_data = load_original_leads('_assets/initial_documents/leads.csv - Sheet1.csv')
    scored_data = load_scored_leads('_assets/initial_documents/leads-export-all (3).csv')
    eval_data = load_eval_set('_assets/initial_documents/eval_set.csv - Evaluation Set.csv')
    
    print(f"Loaded {len(original_data)} companies from original leads")
    print(f"Loaded {len(scored_data)} companies from scored leads")
    print(f"Loaded {len(eval_data)} companies from eval set")
    print()
    
    input_output = compare_input_output(original_data, scored_data)
    patterns = analyze_ranking_patterns(eval_data, scored_data)
    
    print_comprehensive_report(input_output, patterns)

if __name__ == '__main__':
    main()
